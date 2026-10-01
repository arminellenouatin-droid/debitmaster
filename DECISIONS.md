# DECISIONS D'ARCHITECTURE & PRODUIT — MODULE « BOUTIQUE & COMMERCE »
Projet : DebitMaster Pro
Date : 2026-10-01

Ce document consigne toutes les décisions techniques, fonctionnelles et hypothèses prises pour le module « Boutique & Commerce » en application du PRD.

---

## 1. Activité & Tarification (Sprint 1)
- **Code d'activité** : `BOUTIQUE_COMMERCE`.
- **Tarif mensuel** : 50 000 FCFA / mois (configuré dans la table `saas_plan_prices` avec `billing_period = 'MONTHLY'`).
- **Tarif annuel** : 450 000 FCFA / an (soit 3 mois offerts / 25 % d'économie, `billing_period = 'ANNUAL'`).
- **Période d'essai** : 30 jours gratuits dès la création, suivi d'une période de grâce de 5 jours, puis bascule en mode lecture seule.
- **Multi-magasins par défaut** : Tout établissement commerce est initialisé avec au moins un magasin général (`Magasin principal`) et un point de vente/comptoir.

---

## 2. Catalogue, Clients & Fournisseurs (Sprint 2)
- **Arborescence des catégories** : Gérée via la colonne `parent_id` dans la table `categories`. Les sous-catégories référencent l'ID de leur catégorie parente.
- **Prix et conditionnements** : Stockés dans la table `products`. Le prix de vente par défaut est en FCFA sans décimales. L'unité et le conditionnement (`packaging_label`) sont portés par chaque article.
- **Clients** : Table `customers` avec typage `COUNTER` (client anonyme comptoir par défaut) ou `NAMED` (client enregistré avec téléphone, adresse, NIF).
- **Fournisseurs** : Enregistrés dans `stock_purchases` et `supply_requests`.

---

## 3. Circuit de Stock & Réservations (Sprint 3)
- Le stock est isolé de toutes les activités historiques et rattaché à un établissement Commerce et à un magasin Commerce.
- Les affectations de magasins existantes définissent la portée des comptes équipe; le promoteur conserve la portée globale de son établissement.
- Les seuils catalogue `min_stock` et `reorder_point` s’appliquent à chaque magasin pour la V1; le réglage par magasin reste une évolution possible.
- Le stock négatif est désactivé par défaut et ne peut être activé que par un réglage explicite du promoteur.
- Une réservation expire après 24 heures par défaut; la durée est configurable par établissement.
- Les lectures GET sont sans effet de bord. L’expiration est matérialisée et auditée lors d’une mutation Stock; les réservations expirées ne réduisent jamais la quantité disponible et ne sont pas présentées comme actives.
- Le journal des mouvements est append-only. Toute correction est une écriture inverse auditable, jamais une modification ou suppression d’un mouvement.
- Les opérations de stock sont atomiques, idempotentes sur l’ensemble du payload et sérialisées par solde; les changements du réglage stock négatif prennent un verrou cohérent avec les mouvements.
- **Stock physique vs Réservé** : 
  - Le stock physique est maintenu dans `store_inventory`.
  - À la création d'un devis converti ou d'une commande/facture en statut « À régler », le stock est réservé (`order_stock_allocations` avec statut `ALLOCATED`).
  - La sortie physique officielle et irréversible n'a lieu qu'à la confirmation de livraison par le Magasinier (`SETTLED`), avec génération du mouvement `stock_movements`.
- **Méthode de valorisation** : CMP (Coût Moyen Pondéré) par défaut.

---

## 4. Devis, Facturation & Espace Vendeur (Sprint 4)
- **Tables dédiées pour la traçabilité** :
  - `quotes` & `quote_items` pour les devis et proformas.
  - La conversion d'un devis en vente génère un enregistrement de commande/facture avec statut `TO_PAY` (« À régler ») transmis directement à la file d'attente du Caissier.
- **Numérotation séquentielle sans trou** :
  - Devis : `DEV-YYYY-XXXXXX` (ex. `DEV-2026-000001`).
  - Factures : `FAC-YYYY-XXXXXX` (ex. `FAC-2026-000001`).
  - Proforma : `PRO-YYYY-XXXXXX`.
- **Séparation stricte des tâches** :
  - Le rôle `VENDEUR` a le droit de consulter le catalogue, créer des devis et préparer des commandes.
  - Le `VENDEUR` n'a **JAMAIS** le droit d'encaisser (réservé exclusivement au Caissier ou Promoteur).
- **Formats d'impression** :
  - Format Reçu thermique 58/80 mm pour caisse rapide.
  - Format Facture/Devis A4 avec coordonnées complètes de l'établissement, mentions légales et QR code de vérification.

---

## 5. Caisse, Règlements, Sessions & Clôtures Z (Sprint 5)
- **Sessions de caisse (Ticket Z)** :
  - Chaque caisse physique ou logique est modélisée dans `cash_registers` rattachée à un magasin.
  - L'ouverture d'une session (`cash_register_sessions`) exige un fond de caisse initial (`opening_float`).
  - Une seule session ouverte par caisse et par caissier à la fois.
  - La clôture de caisse calcule le solde théorique attendu (`expected_cash = opening_float + encaissements espèces + entrées diverses - sorties diverses - dépenses`).
  - L'écart (`closing_cash_counted - expected_cash`) exige un motif descriptif obligatoire s'il est non nul.
- **Règlements multi-modes & mixtes** :
  - Support de l'ensemble des modes d'encaissement de la sous-région : Espèces, MTN MoMo, Moov Money, Orange Money, Wave, Carte bancaire, Chèque, Virement bancaire, Crédit autorisé.
  - Table `order_payments` horodatée et rattachée à la session de caisse active.
  - Rendu de monnaie calculé automatiquement en temps réel sur la saisie des espèces reçues.
- **Séparation stricte des tâches** :
  - Le `CAISSIER` ne peut pas modifier les lignes d'un devis/facture.
  - Le `VENDEUR` ne peut pas encaisser de règlements.
  - Seul le règlement complet d'une commande (statut `PAID`) rend la commande disponible pour livraison dans l'espace du Magasinier (Sprint 6).

---

## 6. Livraisons, Bons de Livraison (BL), Sorties & Retours (Sprint 6)
- **Circuit de livraison contrôlé** :
  - La file d'attente « À livrer » de l'espace Magasinier est alimentée automatiquement par les commandes payées (`PAID`) ou à crédit validé.
  - La génération du bon de livraison attribue un numéro séquentiel sans trou `BL-YYYY-XXXXXX` via `next_document_number(tenant_id, 'DELIVERY_NOTE')`.
  - La confirmation de livraison par le Magasinier (avec nom du réceptionnaire et code de retrait optionnel) :
    - Décrémente le stock physique officiel dans `store_inventory`.
    - Règle les réservations en attente (`SETTLED` dans `order_stock_allocations`).
    - Enregistre le mouvement de stock officiel (`SALE_DELIVERY` dans `stock_movements`).
    - Bascule la commande en statut `DELIVERED`.
- **Retours clients et Avoirs** :
  - Chaque article retourné est inspecté par le Magasinier avec choix d'affectation :
    - `RESTOCKED` : Réintégration immédiate en stock disponible avec mouvement `CUSTOMER_RETURN`.
    - `SCRAPPED` : Rebut / casse (pas de réintégration en stock).
  - Génération automatique de la facture d'avoir (`AVR-YYYY-XXXXXX` dans `credit_notes`).
- **Séparation stricte des tâches** :
  - Le `MAGASINIER` ne voit et ne traite que les commandes dûment payées ou à crédit autorisé.
  - Le `MAGASINIER` n'a pas accès à la caisse ni aux devis de vente.
  - Le `VENDEUR` ne peut pas valider lui-même la sortie de stock.


