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

---

## 7. Approvisionnements complets, Réceptions 3-voies & Transferts (Sprint 7)
- **Circuit d'approvisionnement** :
  - Suggestion automatique de réapprovisionnement basée sur les seuils d'alerte et points de commande (`current_stock <= reorder_point`).
  - Demandes d'Achat (DA) avec numérotation séquentielle sans trou `DA-YYYY-XXXXXX`.
  - Bons de Commande Fournisseur (BC) avec numérotation `BC-YYYY-XXXXXX`.
  - Seuil d'approbation : les commandes $\ge$ 500 000 FCFA requièrent la validation explicite du Promoteur ou du Gérant (`PENDING_APPROVAL`).
  - Impression A4 du Bon de Commande avec ventilation des frais d'approche (transport, douane, manutention).
- **Réception Fournisseur (BR) & Rapprochement 3-voies** :
  - Numérotation séquentielle `BR-YYYY-XXXXXX`.
  - Rapprochement entre Commande (BC) et Réception physique (BR) avec saisie de la référence facture/BL fournisseur.
  - Entrée en stock physique immédiate (`store_inventory`) avec mouvement `PURCHASE_RECEIPT` dans `stock_movements`.
  - Recalcul automatique du Coût Moyen Pondéré (CMP) selon la formule officielle :
    $CMP_{nouveau} = \frac{(Stock_{ancien} \times CMP_{ancien}) + (Q_{reçue} \times Coût_{revient\_unitaire})}{Stock_{ancien} + Q_{reçue}}$
  - Clôture ou passage en réception partielle (`PARTIALLY_RECEIVED` vs `RECEIVED`) du Bon de Commande.
- **Transferts Inter-Magasins & Dépôts** :
  - Numérotation séquentielle `TRF-YYYY-XXXXXX`.
  - Cycle en deux temps : Expédition (`IN_TRANSIT` avec décrément stock source et mouvement `OUT_TRANSFER`) puis Réception (`RECEIVED` avec incrément stock cible et mouvement `IN_TRANSFER`).
- **Séparation stricte des tâches** :
  - L'opérateur Approvisionnement prépare et émet les DA et BC ; seul le Promoteur/Gérant peut approuver les montants au-delà du seuil.
  - Le Magasinier contrôle physiquement la réception de marchandise et les transferts.

---

## 8. Inventaires Physiques, Comptages, Écarts & Régularisations (Sprint 8)
- **Circuit d'inventaire physique** :
  - Numérotation séquentielle des sessions : `INV-YYYY-XXXXXX` via `next_document_number(tenant_id, 'INVENTORY_SESSION')`.
  - Types d'inventaires supportés : Général (tout le magasin), Partiel (par catégorie ciblée), Tournant / Cyclique.
  - Gel théorique : lors de l'ouverture de la session, le stock théorique en base (`store_inventory`) est capturé avec la valorisation unitaire (CMP) de chaque article (`commerce_inventory_items`).
  - Option "Comptage à l'aveugle" (`is_blind_count`) : masque le stock théorique à la saisie et sur les fiches de comptage pour éviter les biais et fraudes.
  - Fiche de comptage vierge imprimable au format A4 avec en-tête de l'établissement, magasin, date, colonnes pour Comptage 1, Recomptage, Observations et signatures du Chargé d'inventaire et du Gérant.
- **Saisie des comptages, Recomptages & Écarts** :
  - Double comptage : Comptage 1 puis Recomptage si écart constaté.
  - Calcul automatique et en temps réel des écarts de quantité (`final_qty - theo_qty`) et de valorisation financière (`variance_amount_xof`).
  - Badges visuels de statut par ligne : Conforme (vert), Écart (ambre/rouge), Recompté (bleu), Régularisé (violet).
  - Justification obligatoire par l'opérateur pour chaque ligne en écart.
- **Validation & Régularisation automatique de stock** :
  - La validation officielle met à jour le stock physique officiel dans `store_inventory` pour l'aligner sur la quantité physique finale constatée.
  - Chaque écart donne lieu à la génération automatique d'un mouvement d'ajustement dans `stock_movements` (`movement_type = 'ADJUSTMENT'`) avec la référence `INV-YYYY-XXXXXX` et la justification.
  - La session passe en statut `VALIDATED` et devient verrouillée et immuable.
- **Séparation stricte des tâches** :
  - Le rôle `INVENTAIRE` ou `MAGASINIER` peut créer une session, imprimer les fiches, saisir les comptages et justifier les écarts (`inventory.view`, `inventory.count`).
  - **SEUL** le Promoteur (`ADMINISTRATEUR`), le Gérant ou un utilisateur habilité avec `inventory.validate` peut valider l'inventaire et autoriser l'écriture financière de régularisation du stock.

---

## 9. Trésorerie, Dépenses & Immobilisations (Sprint 9)
- **Comptes de trésorerie & Liquidités** :
  - Support des 3 types de liquidités indispensables en Afrique de l'Ouest : Caisses physiques (`CASH`), Banques (`BANK` avec IBAN/RIB), Comptes Mobile Money (`MOBILE_MONEY` avec MTN MoMo, Moov Money, Wave).
  - Suivi en temps réel des soldes courants (`current_balance_xof`) et solde net global disponible.
  - Journal immuable des flux de trésorerie (`commerce_treasury_transactions`) avec horodatage, références, montants et soldes après opération.
- **Virements internes** :
  - Numérotation séquentielle sans trou `VIR-YYYY-XXXXXX` via `next_document_number(tenant_id, 'TREASURY_TRANSFER')`.
  - Transaction atomique : décrément du compte source (montant + frais éventuels) et crédit du compte destination, avec journalisation des deux flux (`TRANSFER_OUT` et `TRANSFER_IN`).
- **Dépenses, Charges & Seuil d'approbation** :
  - Numérotation séquentielle `DEP-YYYY-XXXXXX`.
  - Catégorisation SYSCOHADA : Loyer, Énergie/Eau, Fournitures, Transport/Carburant, Salaires/Primes, Entretien/Maintenance, Impôts/Taxes, Frais bancaires, Marketing, Divers.
  - Justificatif obligatoire (référence pièce, bon, reçu).
  - Règle de seuil de validation : Toute dépense $\ge$ 100 000 FCFA saisie par un collaborateur non-responsable est placée en attente (`PENDING_APPROVAL`, `approval_threshold_exceeded = true`).
  - Validation exclusive par le Promoteur ou Gérant (`expenses.approve`) déclenchant le décaissement effectif et l'écriture de trésorerie.
- **Immobilisations & Amortissements SYSCOHADA** :
  - Numérotation séquentielle `IMM-YYYY-XXXXXX`.
  - Catégorisation avec comptes OHADA révisés : Incorporelles (21), Bâtiments (23), Matériel & outillage (241), Informatique & bureautique (244), Matériel de transport (245), Autres (248).
  - Génération automatique du plan d'amortissement prévisionnel linéaire complet sur la durée d'utilité (1 à 50 ans) : Base, Dotation annuelle, Amortissements cumulés, Valeur Nette Comptable (VNC).
  - Module de sortie d'actif (Cession ou Mise au rebut) avec calcul automatique du résultat de cession ($Prix - VNC$).

---

## 10. Comptabilité Générale SYSCOHADA Révisé (Sprint 10)
- **Plan Comptable SYSCOHADA Révisé (Classes 1 à 8)** :
  - Pré-initialisation automatique et isolée par établissement (`tenant_id`) de tous les comptes directeurs et usuels du système comptable ouest-africain (Classe 1 : Capitaux propres & emprunts, Classe 2 : Actif immobilisé, Classe 3 : Stocks, Classe 4 : Tiers [411 Clients, 401 Fournisseurs, 421 Personnel, 44 État], Classe 5 : Trésorerie [521 Banques, 571 Caisse, 572 Mobile Money], Classe 6 : Charges [601 Achats, 6031 Variation stocks, 605/62/63 Services, 66 Frais de personnel, 68 Dotations], Classe 7 : Produits [701 Ventes marchandises, 706 Prestations, 77 Revenus financiers], Classe 8 : H.A.O.).
  - Possibilité d'enrichissement et d'adjonction de sous-comptes personnalisés à tout moment.
- **Journaux Auxiliaires Standardisés** :
  - Ventes (`VE`), Achats (`AC`), Banque (`BQ`), Caisse (`CA`), Opérations Diverses (`OD`), À-Nouveau (`AN`), Immobilisations (`IM`).
- **Principe Fondamental de la Partie Double & Contrôle d'Équilibre** :
  - Vérification obligatoire : $\sum \text{Débits} = \sum \text{Crédits}$.
  - Rejet bloquant immédiat (Code HTTP 400) par le backend si l'écriture est déséquilibrée, avec indication de l'écart exact en FCFA.
  - Numérotation chronologique continue et infalsifiable `ECR-YYYY-XXXXXX`.
- **Génération Temps Réel des États Réglementaires OHADA** :
  - **Balance Générale à 6 colonnes** : Mouvements période (Débit/Crédit), Cumul (Débit/Crédit), Soldes de clôture (Débiteur/Créditeur) avec vérification de l'égalité globale $\sum \text{Soldes Débiteurs} = \sum \text{Soldes Créditeurs}$.
  - **Grand Livre des Comptes** : Historique exhaustif des écritures compte par compte avec solde progressif en ligne.
  - **Compte de Résultat en Solde Intermédiaire de Gestion (SIG)** : Calcul automatisé de la Marge Commerciale (701 - 601 - 6031), Valeur Ajoutée (VA), Excédent Brut d'Exploitation (EBE), Résultat d'Exploitation (REX), Résultat Financier, Résultat Hors Activités Ordinaires (HAO) et Résultat Net de l'exercice.
  - **Bilan SYSCOHADA** : Contrôle d'équilibre Actif (Immobilisations nettes + Stocks + Créances clients + Trésorerie active) vs Passif (Capitaux propres + Résultat net + Dettes fournisseurs + Trésorerie passive).
- **Habilitations & Rôles** :
  - Permissions dédiées `accounting.view`, `accounting.entry`, `accounting.close`.
  - Attribuées exclusivement aux profils `COMPTABLE`, `GERANT` et `ADMINISTRATEUR`.

---

## 11. Personnel, Présences, Commissions, Dashboards par profil, Rapports et Notifications (Sprint 11)
- **Gestion du Personnel & Fiches Collaborateurs** :
  - Affectation multi-magasins et multi-rôles au sein du tenant `BOUTIQUE_COMMERCE`.
  - Statut actif/désactivé et gestion des habilitations sans rupture d'isolation.
- **Présences & Pointage Journalier** :
  - Table `commerce_attendance` avec date de travail, horodatage d'arrivée (`check_in_time`) et de départ (`check_out_time`).
  - Statuts d'assiduité : `PRESENT`, `LATE`, `ABSENT`, `ON_LEAVE`, `EXCUSED`.
  - Calcul et suivi en minutes des retards.
- **Objectifs de Vente & Calcul Automatisé des Commissions** :
  - Table `commerce_sales_targets` : Quotas mensuels en FCFA fixés par commercial (`target_revenue_xof`).
  - Formules de rémunération configurables :
    - Pourcentage sur le Chiffre d'Affaires encaissé (`REVENUE_PERCENT`).
    - Pourcentage sur la Marge brute générée (`MARGIN_PERCENT`).
    - Prime fixe sur palier d'atteinte du quota (`FIXED_BONUS`).
  - Calcul dynamique en temps réel fondé sur les factures et commandes réglées.
  - Table `commerce_commissions` avec cycle de validation : `PENDING` $\rightarrow$ `APPROVED` $\rightarrow$ `PAID`.
- **Dashboards Opérationnels Finaux par Profil** :
  - Sélecteur et vue dédiée selon le rôle de l'utilisateur avec indicateurs et raccourcis d'action :
    - **Promoteur / Gérant** : Chiffres d'affaires jour/mois, trésorerie active disponible (Caisse, Banque, Mobile Money), alertes de validation en attente (dépenses > 100k, achats, inventaires).
    - **Vendeur / Commercial** : Ventes jour/mois, jauge de progression d'objectif, commission estimée, devis en cours, factures à encaisser.
    - **Caissier** : File des commandes en attente d'encaissement, encaissements du jour, session de caisse en cours.
    - **Magasinier** : Bons de livraison à préparer (BL), réceptions attendues (BR), alertes de stock critique.
    - **Approvisionnement** : Suggestions de réapprovisionnement sous seuil min, bons de commande (BC) en cours, dettes fournisseurs.
    - **Inventaire** : Sessions actives, fiches de comptage, état des régularisations de stock.
    - **Comptable** : Écritures récentes, conformité partie double, raccourcis balance et états financiers.
- **Rapports Analytiques & Classification ABC de Pareto** :
  - Filtrage multi-périodes : Aujourd'hui, 7 jours, 30 jours, Ce mois.
  - Indicateurs de rentabilité : CA Net, Coût CMP Total, Marge Brute Globale (FCFA et %), Panier Moyen.
  - Ventilation par catégorie de produits et performance par commercial.
  - **Classification ABC (Loi de Pareto)** :
    - Classe A : Produits générant les premiers 80% du CA (coeur stratégique).
    - Classe B : Produits intermédiaires générant les 15% suivants (80% à 95%).
    - Classe C : Produits dormants / faible rotation générant les derniers 5% (95% à 100%).
  - Balances âgées pour créances clients et dettes fournisseurs (< 30j, 30-60j, > 60j).
  - Export CSV direct compatible Excel (UTF-8 BOM) et format d'impression A4.
- **Centre de Notifications & Alertes Métier** :
  - Table `commerce_notifications` avec typologie d'alerte (`INFO`, `SUCCESS`, `WARNING`, `ALERT`), lien d'action directe et horodatage.
  - Composant cloche interactif `CommerceNotificationBell` avec badge des non-lues et marquage instantané.

---

## 12. PWA Hors-ligne, Durcissement de Sécurité & Validation Globale (Sprint 12)
- **Manifeste PWA & Expérience Mobile Installable** :
  - `src/app/manifest.ts` générant automatiquement `/manifest.webmanifest`.
  - Affichage en mode application autonome (`display: standalone`), icônes masquables et thème couleur (`#063327`).
  - Métadonnées Apple Web App configurées (`apple-mobile-web-app-capable`).
- **Résilience Hors-ligne & File de Synchronisation** :
  - Module `src/lib/offline-sync.ts` avec file d'attente locale (`localStorage`).
  - Détection automatique du retour réseau (`online` event listener) avec rejeu des opérations de caisse et de vente.
- **Durcissement de Sécurité & Contrôles AGENTS.md §14** :
  - RLS activée sur 100% des tables créées au fil des 12 sprints (`revoke all from anon, authenticated`).
  - Politiques RLS strictes avec isolation hermétique par établissement (`tenant_id`).
  - Validation serveur des montants, prix, CMP et cohérence débit/crédit (aucun calcul financier confié au client).
  - Zéro secret dans le code ou l'historique de commit.
  - Tests d'isolation multi-tenant confirmant l'inviolabilité des données entre établissements concurrents.
- **Suite de Recette Maîtresse E2E (Master Test Suite)** :
  - `tests/commerce-sprint12-e2e-master-verification.test.mjs` simulant l'intégralité du cycle de vie commercial de bout en bout :
    1. Multi-magasins et catalogue
    2. Devis $\rightarrow$ Facture
    3. Caisse $\rightarrow$ Paiement $\rightarrow$ Ticket Z
    4. Bon de livraison $\rightarrow$ Sortie physique $\rightarrow$ Coût des ventes (CMP)
    5. Commande fournisseur $\rightarrow$ Réception BR $\rightarrow$ Recalcul CMP moyen pondéré
    6. Inventaire $\rightarrow$ Écart constaté $\rightarrow$ Régularisation automatique de stock
    7. Trésorerie multi-liquidités $\rightarrow$ Virement interne $\rightarrow$ Seuil de validation dépense $\ge$ 100k
    8. Écriture comptable SYSCOHADA $\rightarrow$ Contrôle d'équilibre de la partie double ($\sum \text{Débit} = \sum \text{Crédit}$)
    9. Quotas commerciaux $\rightarrow$ Commissions calculées et validées $\rightarrow$ Pareto ABC
    10. Synchronisation hors-ligne PWA
    11. Isolation des données multi-tenant (Tenant A vs Tenant B).








