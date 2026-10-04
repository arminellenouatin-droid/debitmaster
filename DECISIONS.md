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

---

## 13. Module « Atelier de couture » — Activité, Sites & Rôles (Sprint 1)
- **Code d'activité** : `ATELIER_COUTURE` (6ᵉ activité indépendante du SaaS DebitMaster).
- **Tarification officielle** :
  - Mensuel : 150 000 FCFA / mois (`billing_period = 'MONTHLY'`).
  - Annuel : 1 350 000 FCFA / an (`billing_period = 'ANNUAL'`, soit 25 % de réduction / 3 mois offerts).
  - Période d'essai : 30 jours gratuits dès la création, suivi d'une période de grâce de 5 jours, puis bascule en mode lecture seule (règle globale SaaS).
  - Étanche : aucun plan historique ou plan Boutique & Commerce ne peut être souscrit par un établissement Couture, et inversement.
- **Entité Sites (`couture_sites`)** :
  - Modèle dual : `site_type IN ('BOUTIQUE', 'ATELIER')`.
  - Multi-pays et multidevise : chaque site a son pays (Togo, Cameroun, etc.) et sa devise locale (`currency IN ('FCFA', 'XOF', 'XAF', 'EUR', 'USD', 'GHS', 'NGN')`).
  - Un établissement peut disposer d'un atelier central à Lomé et de plusieurs boutiques à Lomé et Douala.
- **Rôles & Permissions (`couture_roles`, `couture_role_permissions`)** :
  - 11 rôles opérationnels définis : `DIRECTEUR_GERANT`, `CHEF_AGENCE`, `VENDEUR`, `CHEF_ATELIER`, `OUVRIER`, `MAGASINIER_ATELIER`, `MAGASINIER_BOUTIQUE`, `ACHETEUR`, `COMPTABLE`, `RH`, `INVENTAIRE`.
  - Catalogue de 37 permissions granulaires et exclusives à l'activité.
  - Séparation stricte des tâches : `OUVRIER` n'a accès qu'à ses tâches et à la déclaration d'achèvement (`piecework.declare`) ; `COMPTABLE` valide les achats < 50 000 FCFA ; `RH/Direction` valide les achats ≥ 50 000 FCFA et la paie.
- **Métiers de production (Crafts)** :
  - Sur `couture_employees`, un ouvrier détient un ou plusieurs métiers : `COUPEUR`, `COUTURIER`, `BRODEUR_MAIN`, `BRODEUR_MACHINE`, `FINISSEUR`.
- **Provisionnement automatique (`provision_couture_tenant()`)** :
  - À la création d'un établissement `ATELIER_COUTURE`, création automatique de `Atelier central`, `Boutique principale`, des 11 rôles système avec leurs permissions par défaut, et enregistrement de l'événement d'audit.
- **Visibilité des mots de passe (Feature transversale)** :
  - Composant `PasswordField.tsx` avec bouton œil (SVG ouvert / barré), accessibilité (`aria-label`, `aria-pressed`, `tabIndex=0`) et support thèmes clair/sombre.
  - Intégré sur `/connexion`, `/inscription`, `/dashboard/settings`, `/invitation/accept`.

---

## 14. Module « Atelier de couture » — Catalogue mode & Clients avec mensurations (Sprint 2)
- **Catalogue Vêtements** :
  - **Modèles (`couture_models`)** : Goodluck, Danshiki, Agbada, Abacost, Robe, Boubou (extensibles par l'établissement).
  - **Gammes (`couture_ranges`)** : Leader (rang 1), VIP (rang 2), Royale (rang 3), Présidentiel (rang 4).
  - **Grille de prix (`couture_price_grid`)** : Matrice modèle × gamme stockée en base avec prix adulte et prix enfant.
  - **Règle de tarification enfant** : Le prix enfant est égal à 50 % du prix adulte par défaut (`computeChildPrice()`), modifiable individuellement par l'établissement.
  - **Tailles (`couture_sizes`)** : S, M, MK (Medium King), L, XL, 2XL, 3XL, et Sur mesure (`SUR_MESURE`).
  - **Couleurs (`couture_colors`)** : Couleurs de base avec code hexadécimal et support de couleurs personnalisées.
- **Catalogue Accessoires (`couture_accessories`)** :
  - Famille dédiée distincte des vêtements : sacs, chaussettes, lunettes, manchettes, montres, accessoires divers.
  - Prix de vente, coût d'achat et seuil d'alerte stock paramétrable.
- **Fiches clients & Mensurations (`couture_customers`)** :
  - Coordonnées : nom, prénom, téléphone normalisé (identifiant unique par établissement), email, genre, anniversaire, photo et notes morphologiques.
  - 15 mensurations normalisées en centimètres (cou, poitrine, taille, hanches, carrures, longueur manche, biceps, poignet, longueur veste/robe, pantalon, cuisse, bas, entrejambe).
  - Bénéficiaires habituels (`habitual_beneficiaries`) : conservation des proches pour qui le client commande fréquemment avec leurs mensurations respectives.
- **Séparation des droits** :
  - `VENDEUR` / `CHEF_AGENCE` : lecture du catalogue (`catalog.view`), création et gestion des clients (`customers.manage`).
  - `DIRECTEUR_GERANT` / `PROMOTEUR` : gestion des modèles, gammes et grille de prix (`catalog.manage`).
  - `OUVRIER` : aucun accès direct au fichier client ni à la grille tarifaire boutique.

---

## 15. Module « Atelier de couture » — Vente boutique & Règlements (Sprint 3)
- **Typologie des 4 ventes boutique (`sale_type`)** :
  - `VENTE_SIMPLE` : Vente directe de produit fini en stock boutique (vêtement ou accessoire).
  - `COMMANDE` : Commande de fabrication sur mesure ou de réassort déclenchée côté atelier après versement de l'acompte/paiement.
  - `CONFECTION` : Client apporte son tissu, seule la main d'œuvre (façon) est facturée ; aucun impact sur le stock de tissu de l'atelier (`fabric_provided_by_customer = true`).
  - `RETOUCHE` : Prestation de modification ou d'ajustement sur un vêtement existant, avec notes de retouche horodatées.
- **Numérotation séquentielle inviolable** :
  - Format réglementaire : `VTE-YYYY-XXXXXX` (ex. `VTE-2026-000001`).
  - Calcul de séquence garanti et isolé par établissement (`tenant_id`).
- **Calcul serveur des montants & Totaux** :
  - Lignes de vente : `total_price_xof = quantity * unit_price_xof`.
  - Vente globale : `subtotal_amount_xof`, `discount_amount_xof` plafonnée au sous-total, `total_amount_xof`, `paid_amount_xof`, `balance_amount_xof`.
  - Statut de règlement dynamique : `DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `PAID`.
- **Règlements & Acomptes (`couture_sale_payments`)** :
  - Modes de paiement : `CASH`, `MOBILE_MONEY`, `CARD`, `BANK_TRANSFER`.
  - Gestion des acomptes initiaux à la création de la vente et encaissements complémentaires ultérieurs avec recalcul automatique du reste à payer.
- **Sécurité RLS & RBAC** :
  - RLS activée sur `couture_sales`, `couture_sale_lines`, `couture_sale_payments` avec politiques isolées par `tenant_id`.
  - Permissions requises : `sales.view` pour la consultation, `sales.create` pour l'enregistrement de ventes et règlements.
  - `OUVRIER` exclu des données financières et de vente boutique.

---

## 16. Module « Atelier de couture » — Encaissement multidevise & Paiements Mobile Money / TPE (Sprint 4)
- **Affichage et Saisie Simultanée Multidevise (FCFA, USD, EUR)** :
  - Taux officiels de référence par défaut : 1 EUR = 655,957 FCFA (zone franc), 1 USD = 600,00 FCFA (taux marché), modifiables et historisés par établissement dans `couture_exchange_rates`.
  - Les espèces peuvent être reçues simultanément en FCFA, USD et EUR sur le même ticket comptoir (`MultiCurrencyCashInput`).
  - Conversion instantanée serveur en équivalent FCFA entier et calcul du rendu de monnaie (`changeDueFcfa`) dans la devise souhaitée.
- **Restriction Stricte de Devise Étrangère** :
  - Conformément au PRD §6.4 : le multidevise ne s'applique **qu'aux espèces au comptoir**. Les autres modes (Mobile Money, TPE, virement, carte bancaire) restent impérativement libellés dans la devise locale de la boutique (FCFA).
- **Intégration Mobile Money dans le Flux de Caisse** :
  - Table `couture_mobile_money_requests` traçant l'envoi de la demande push sur le mobile du client (`MTN`, `MOOV`, `ORANGE`, `WAVE`).
  - Statuts trackés : `PENDING` $\rightarrow$ `SUCCESSFUL` / `FAILED`.
- **Intégration TPE / Carte Bancaire** :
  - Saisie obligatoire de la référence de transaction TPE physique (`tpe_reference`).
- **Règle d'Ordonnancement Métier (PRD §6.4)** :
  - Si Mobile Money et TPE sont combinés sur un même règlement, le Mobile Money doit obligatoirement être déclenché et validé en premier avant de passer la transaction TPE.
- **Contrôle d'accès & Droits** :
  - Permission `sales.multi_currency` requise pour l'encaissement comptoir multidevise (`VENDEUR`, `CHEF_AGENCE`, `DIRECTEUR_GERANT`).
  - `OUVRIER` et `MAGASINIER` strictement exclus de la caisse.

---

## 17. Module « Atelier de couture » — Production, Circuit d'étapes & Contrôle qualité (Sprint 5)
- **Fiches de Fabrication (`couture_production_cards`)** :
  - Déclenchées automatiquement depuis les ventes/commandes/confections ou créées manuellement par le chef d'atelier (`card_type IN ('COMMANDE', 'CONFECTION', 'RETOUCHE', 'STOCK_MANUFACTURE')`).
  - Numérotation séquentielle inviolable au format `FAB-YYYY-XXXXXX` (ex. `FAB-2026-000001`).
  - Stockage des mensurations du client (`measurements_snapshot`), priorité (`NORMAL`, `URGENT`, `VERY_URGENT`), date cible de livraison et option broderie (`has_embroidery`, `MAIN`/`MACHINE`).
- **Circuit Fixe des Étapes de Fabrication (`couture_production_steps`)** :
  - Séquence ordonnée non réversible : `COUPE` $\rightarrow$ `COUTURE` $\rightarrow$ `BRODERIE` (si applicable) $\rightarrow$ `FINITION_REPASSAGE` $\rightarrow$ `CONTROLE_QUALITE` $\rightarrow$ `EMBALLAGE` $\rightarrow$ `LIVRAISON`.
  - Statuts d'étape : `PENDING`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`.
  - L'achèvement d'une étape active automatiquement l'étape suivante et met à jour le statut global de la fiche.
- **Assignation et Matrice des Métiers** :
  - Vérification stricte de compatibilité métier à l'assignation :
    - `COUPE` $\rightarrow$ Ouvrier avec métier `COUPEUR`.
    - `COUTURE` $\rightarrow$ Ouvrier avec métier `COUTURIER`.
    - `BRODERIE` $\rightarrow$ Ouvrier avec métier `BRODEUR_MAIN` ou `BRODEUR_MACHINE`.
    - `FINITION_REPASSAGE` $\rightarrow$ `FINISSEUR` ou `COUTURIER`.
- **Contrôle Qualité de Conformité (`couture_quality_controls`)** :
  - Étape obligatoire avant emballage et livraison.
  - Deux issues possibles :
    - `PASSED` : validation de la pièce, étape `CONTROLE_QUALITE` marquée `COMPLETED`, fiche basculée à `PACKED` puis `EMBALLAGE`.
    - `REJECTED` : motif obligatoire, étape marquée `REJECTED`, réactivation de l'étape de production en cause (ex. `COUTURE`) en `IN_PROGRESS` pour reprise par l'ouvrier sans clôturer la fiche.
- **Sécurité & Droits d'Accès** :
  - `CHEF_ATELIER` : pilotage complet (`production.view`, `production.manage`, `production.assign`, `production.quality_control`).
  - `OUVRIER` : consultation de ses tâches (`production.view`) et déclaration d'achèvement (`piecework.declare`), aucun droit de réassignation ni de contrôle qualité.
  - RLS activée sur `couture_production_cards`, `couture_production_steps`, `couture_quality_controls`.

---

## 18. Module « Atelier de couture » — Paie à la tâche des ouvriers & Barème (Sprint 6)
- **Barème Paramétrable des Tâches (`couture_piecework_rates`)** :
  - Tarifs de référence Distinction :
    - Chapeau : 1 000 FCFA (sans broderie) / 1 000 FCFA (avec broderie)
    - Agbada : 5 000 FCFA / 6 000 FCFA
    - Haut Goodluck : 1 600 FCFA / 3 000 FCFA
    - Haut Danshiki : 2 000 FCFA / 4 000 FCFA
    - Pantalon droit : 2 000 FCFA
    - Pantalon simple : 1 000 FCFA
    - Robe : 3 000 FCFA / 3 000 FCFA
    - Boubou : 3 000 FCFA / 3 000 FCFA
  - Barème entièrement administrable par la direction (`piecework.manage`), avec capture immuable du tarif unitaire au moment où la tâche est déclarée (protection contre les modifications rétroactives).
- **Majoration Travail Hors Horaires (+20 %)** :
  - Conformément au PRD §12.1 : toute tâche déclarée hors des horaires prévus bénéficie d'une majoration automatique de 20 % (`overtime_multiplier = 1.2`), tracée de manière transparente sur la tâche.
- **Décompte de Paie Hebdomadaire Ouvriers (`couture_weekly_payrolls`)** :
  - Période : du lundi (`week_start_date`) au dimanche (`week_end_date`).
  - Cumul dynamique des tâches accomplies : nombre de tâches, montant de base, supplément majoration heures, primes et retenues éventuelles, montant net dû.
  - Cycle de statut : `DRAFT` $\rightarrow$ `VALIDATED` (visa Direction / RH) $\rightarrow$ `PAID` (règlement avec référence).
- **Contrôle d'Accès & Sécurité** :
  - `OUVRIER` : consulte ses propres tâches et barème (`piecework.view`), déclare ses achèvements (`piecework.declare`), aucun droit de modification du barème ni d'auto-validation de paie.
  - `COMPTABLE` : calcule les décomptes hebdomadaires (`payroll.calculate`).
  - `RH / DIRECTION` : valide et approuve les décomptes (`payroll.approve`).
  - RLS activée sur `couture_piecework_rates`, `couture_completed_tasks`, `couture_weekly_payrolls`.

---

## 19. Module « Atelier de couture » — Fournitures, Circuit d'achats à seuil & Petite caisse (Sprint 7)
- **Catalogue Fournitures & Stocks Atelier (`couture_supplies`, `couture_workshop_supply_stocks`)** :
  - Familles : Tissus (`FABRIC`), Fils (`THREAD`), Boutons (`BUTTON`), Fermetures éclair (`ZIPPER`), Doublures (`LINING`), Bouclerie & mercerie (`ACCESSORY_HARDWARE`), Emballages (`PACKAGING`), Autres.
  - Suivi des unités (mètres, pièces, rouleaux, boîtes, bobines), seuil de réapprovisionnement et coût d'achat.
- **Circuit d'Approbation des Achats à Seuil Strict (50 000 FCFA)** :
  - `Achat < 50 000 FCFA` (`SINGLE_ACCOUNTANT`) : La validation du **comptable seul** (`purchases.approve_small`) suffit pour passer commande.
  - `Achat ≥ 50 000 FCFA` (`THREE_STEP`) : Circuit hiérarchique complet obligatoire en 3 étapes :
    1. Avis de l'acheteur (`buyer_opinion` FAVORABLE / DÉFAVORABLE)
    2. Validation préalable du comptable (`accountant_approval = APPROVED`)
    3. Accord final de la Direction / RH (`purchases.approve_large`, `direction_approval = APPROVED`).
  - Numérotation séquentielle inviolable au format `DA-YYYY-XXXXXX`.
- **Petite Caisse d'Atelier (`couture_petty_cash_funds`, `couture_petty_cash_expenses`)** :
  - Fonds fixe de **20 000 FCFA** par atelier confié au magasinier.
  - Plafond strict par dépense : **2 000 FCFA maximum** (contrôle et rejet serveur si supérieur à 2 000 FCFA ou si solde disponible insuffisant).
  - Visa comptable obligatoire dans le système (`petty_cash.visa`). En cas de rejet par le comptable, le montant de la dépense est automatiquement restitué au solde de la petite caisse.
  - Renouvellement automatisé du fonds au niveau initial (20 000 FCFA) tracé en mouvement d'audit.
- **Sécurité & Droits d'Accès** :
  - `MAGASINIER_ATELIER` : gère les stocks fournitures (`supplies.manage`), engage les petites dépenses (`petty_cash.spend`), aucun droit d'approbation d'achat ni de visa de sa propre caisse.
  - `COMPTABLE` : valide les achats < 50k (`purchases.approve_small`), vise les petites dépenses et renouvellements (`petty_cash.visa`).
  - `RH / DIRECTION` : valide les achats ≥ 50k (`purchases.approve_large`).
  - RLS activée sur les 5 tables créées.

---

## 20. Module « Atelier de couture » — Stocks multi-sites, Transferts & Inventaires physiques (Sprint 8)
- **Stocks Produits Finis par Boutique (`couture_boutique_stocks`)** :
  - Suivi par site (`site_id`), typologie (`product_type` : Vêtement / Accessoire), liaisons facultatives aux modèles, gammes, tailles et coloris.
  - Seuil d'alerte paramétrable (`min_threshold`, défaut 2 unités) pour détection proactive du réapprovisionnement boutique.
- **Transferts Multi-Sites & Suivi d'Écarts (`couture_transfers`, `couture_transfer_lines`)** :
  - Types de transferts : Atelier $\rightarrow$ Boutique, Boutique $\rightarrow$ Boutique, Boutique $\rightarrow$ Atelier, Atelier $\rightarrow$ Atelier.
  - Numérotation séquentielle inviolable au format `TRF-YYYY-XXXXXX`.
  - Cycle de vie : `DRAFT` $\rightarrow$ `IN_TRANSIT` (expédition horodatée) $\rightarrow$ `RECEIVED` (conforme sans écart) ou `DISCREPANCY` (écart quantitatif détecté à la réception).
- **Inventaires Physiques & Clôture d'Écarts (`couture_inventory_sessions`, `couture_inventory_counts`)** :
  - Sessions d'inventaire par site (`site_id`), types d'inventaire : stocks boutique produits finis (`BOUTIQUE_FINISHED_GOODS`) ou fournitures atelier (`ATELIER_SUPPLIES`).
  - Numérotation séquentielle au format `INV-YYYY-XXXXXX`.
  - Calcul automatique et transparent des écarts : quantité théorique vs quantité comptée, montant de valorisation de l'écart en FCFA (`variance_value_xof`).
  - Clôture de session (`VALIDATED`) : ajuste automatiquement et fidèlement les niveaux de stock réel (`couture_boutique_stocks` ou `couture_supplies`), consigne les totaux dans le journal d'audit immuable.
- **Sécurité & Droits d'Accès** :
  - `CHEF_AGENCE` / `MAGASINIER_BOUTIQUE` : consultation des stocks (`stock.view`), création et expédition de transferts (`stock.transfer`, `stock.manage`), saisie des comptages (`inventory.count`).
  - `INVENTAIRE` / `DIRECTEUR_GERANT` : validation définitive des inventaires et ajustement des stocks en base (`inventory.validate`).
  - RLS activée à 100 % sur les 5 tables créées, permissions minimales et isolation multi-tenant stricte par `tenant_id`.

---

## 21. Module « Atelier de couture » — Trésorerie multi-caisses & Comptabilité SYSCOHADA (Sprint 9)
- **Trésorerie Multi-Caisses & Suivi des Liquidités (`couture_treasury_accounts`, `couture_treasury_transactions`)** :
  - Typologie : Caisse de boutique (`CASH`), Compte bancaire (`BANK`), Mobile Money (`MOBILE_MONEY`), Terminal de paiement (`POS`), Petite caisse d'atelier (`PETTY_CASH`).
  - Tenue du solde après mouvement (`balance_after`) garantissant l'intégrité comptable et l'absence de divergence.
- **Virements Internes de Trésorerie (`couture_treasury_transfers`)** :
  - Numérotation séquentielle inviolable au format `VIR-YYYY-XXXXXX`.
  - Exécution atomique : débit du compte source, conversion au taux applicable en cas de devises distinctes (ex: boutique Lomé en XOF vers boutique Douala en XAF), crédit du compte destination, et écriture des transactions de trésorerie correspondantes.
- **Plan Comptable SYSCOHADA Révisé & Journaux Dédiés (`couture_chart_of_accounts`, `couture_accounting_journals`)** :
  - 28 comptes fondamentaux pré-configurés :
    - 701 (Vente vêtements finis) vs 706 (Prestations de confection sur tissu client et retouches).
    - 601 (Achats tissus) et 602 (Fournitures mercerie).
    - 662 (Rémunérations ouvriers à la tâche) et 421 (Personnel rémunérations dues).
    - 571 (Caisse), 572 (Petite caisse atelier), 573 (Mobile Money).
  - 6 journaux auxiliaires : Ventes (`VE`), Achats (`AC`), Banque (`BQ`), Caisse (`CA`), Opérations Diverses (`OD`), Paie à la tâche (`PA`).
- **Pièces & Écritures Comptables à Partie Double Équilibrée (`couture_journal_entries`, `couture_journal_entry_lines`)** :
  - Numérotation séquentielle inviolable au format `ECR-YYYY-XXXXXX`.
  - Contrôle strict de l'égalité de la partie double ($\sum \text{Débit} = \sum \text{Crédit}$) avec blocage immédiat de toute écriture asymétrique.
  - Génération automatique intégrée pour les ventes (avec ventilation HT / TVA 443 / créance 411 / caisse 571), les achats, la petite caisse (602 / 572) et la paie à la tâche ouvrière (662 / 421 ou 571).
- **Consolidation Multidevise Multi-Sites (`couture_consolidated_settings`, `/api/couture/accounting/consolidated-ledger`)** :
  - Devise de référence de l'établissement (défaut `FCFA`).
  - Calcul dynamique de la balance générale et du grand livre consolidé pour tous les sites (Lomé et Douala), avec conversion historisée et préservation absolue des écritures locales.
- **Sécurité & Droits d'Accès** :
  - `COMPTABLE` / `DIRECTEUR_GERANT` : accès exclusif à la trésorerie (`treasury.view`) et à la comptabilité générale (`accounting.view`).
  - `VENDEUR` / `OUVRIER` : aucun accès aux écritures comptables ni aux comptes de trésorerie.
  - RLS activée à 100 % sur les 8 tables créées, révocation stricte de tout accès direct anonyme/authentifié non filtré.

---

## 22. Module « Atelier de couture » — Personnel, Présence géolocalisée, Paie mensuelle & Primes vendeurs (Sprint 10)
- **Horaires & Plannings de Travail (`couture_work_schedules`)** :
  - Catégorisation du personnel : Boutique (Lun-Sam 9h-13h & 15h-21h, Dim 10h-13h & 15h-19h), Administratif (Lun-Sam 8h-12h & 14h-18h), Atelier (Lun-Sam 8h-11h, 12h-15h, 16h-20h).
  - Couverture minimale en continu garantie en boutique avec pause échelonnée.
- **Présence Géolocalisée & Incidents d'Éloignement (`couture_attendance_logs`, `couture_attendance_incidents`)** :
  - Pointage d'arrivée et de départ avec contrôle de proximité par formule de Haversine (`verifySiteGeofence`, rayon 300 mètres).
  - Détection automatique des absences prolongées : tout éloignement non autorisé supérieur à **15 minutes** génère un incident de présence et la déconnexion immédiate de la session.
- **Paie Mensuelle du Personnel Administratif & Boutique (`couture_monthly_payrolls`)** :
  - Numérotation séquentielle inviolable au format `PAY-YYYY-XXXXXX`.
  - Calcul transparent : salaire de base + primes - retenues = net à payer.
  - Cycle de validation sécurisé : `DRAFT` $\rightarrow$ `APPROVED` (visa RH / Direction) $\rightarrow$ `PAID`.
- **Moteur d'Incentives, Points & Primes Vendeurs (`couture_sales_incentives_config`, `couture_seller_points`)** :
  - **Points de vente** : 1 point par tranche de 50 000 FCFA vendue.
  - **Gros achat** : toute vente unique supérieure à 1 000 000 FCFA attribue automatiquement une prime de **2 %** au vendeur.
  - **Fidélité client trimestrielle** : prime de **2 %** si un même client commande $\ge 4$ fois dans le trimestre ou $\ge 2$ fois pour un total $> 3 500 000$ FCFA.
  - **Récompenses d'excellence annuelle** :
    - 1ᵉʳ vendeur ($\ge 1 600$ points et $\ge 3$ ans d'ancienneté) : Voiture neuve + bon carburant 300 000 FCFA.
    - 2ᵉ vendeur ($\ge 900$ points et $\ge 3$ ans d'ancienneté) : Moto neuve + bon carburant 150 000 FCFA.
  - **Alertes de motivation mensuelles** : alerte de niveau 1 si $< 60$ points sur le mois, et alerte renforcée de niveau 2 pour accompagnement RH si $< 60$ points pendant 2 mois consécutifs.
- **Classement & Palmarès (`/api/couture/incentives/leaderboard`)** :
  - Classement dynamique individuel des vendeurs (mensuel et annuel) avec badges d'éligibilité aux véhicules.
  - Comparatif consolidé des performances de chiffre d'affaires entre boutiques.
- **Sécurité & Droits d'Accès** :
  - `RH / DIRECTION` : gestion des plannings (`hr.manage`), approbation finale de la paie (`payroll.approve`), ajustement des seuils de primes (`incentives.manage`).
  - `VENDEUR` : enregistrement de son pointage (`attendance.track`), consultation de ses points et classements (`incentives.view`).
  - RLS activée à 100 % sur les 6 tables créées.

---

## 23. Module « Atelier de couture » — Cockpits par profil, Rapports Pareto ABC & Notifications (Sprint 11)
- **Cockpits Opérationnels & Tableaux de Bord par Profil (`/api/couture/dashboards/profile`)** :
  - Métriques contextualisées selon le rôle de l'utilisateur :
    - **Direction / Promoteur** : Chiffre d'affaires global et encaissé, commandes de production actives, cartes urgentes, demandes d'achat en attente, alertes et notifications non lues.
    - **Vendeur / Chef d'agence** : Points du mois, primes de gros achat, ventes de la boutique, commandes en cours.
    - **Chef d'atelier** : Fiches par étape (Coupe, Couture, Broderie, Finitions, QC), contrôles qualité en attente.
    - **Ouvrier** : Tâches de la semaine, décompte de paie à la tâche en cours.
    - **Comptable / Magasinier / RH** : Alertes spécialisées selon le domaine de responsabilité.
- **Analyse Analytique ABC de Pareto (`couture-analytics.ts`, `/api/couture/reports/pareto-abc`)** :
  - Classification automatisée selon la loi des 80/15/5 :
    - **Classe A** : Modèles et articles générant les premiers 80 % du chiffre d'affaires cumulé (coeur stratégique de la marque).
    - **Classe B** : Articles générant les 15 % suivants (80 % à 95 % du CA).
    - **Classe C** : Articles à rotation lente générant les 5 % restants (95 % à 100 % du CA).
  - Filtrage possible par boutique ou consolidé sur l'ensemble des sites de l'établissement.
- **Centre de Notifications & Alertes Métier (`couture_notifications`, `/api/couture/notifications`)** :
  - Typologies d'alertes : Demandes d'achat à valider (`PURCHASE_APPROVAL`), Stock critique sous seuil (`LOW_STOCK`), Alertes de production & retards (`PRODUCTION_ALERT`), Incidents de présence (`ATTENDANCE_INCIDENT`), Paie prête pour visa (`PAYROLL_READY`), Contrôle qualité refusé (`QC_REJECTED`), Général (`GENERAL`).
  - Niveaux de gravité : `INFO`, `WARNING`, `URGENT`.
  - Routage par rôle ou utilisateur avec marquage de lecture (`PATCH /api/couture/notifications/[id]/read`).
- **Sécurité & Droits d'Accès** :
  - Contrôle d'accès strict côté serveur (`dashboard.view`, `reports.view`, `reports.export`).
  - RLS activée à 100 % sur `couture_notifications` avec isolation multi-tenant stricte par `tenant_id`.

---

## 24. Module « Atelier de couture » — Établissement de Démonstration DISTINCTION, Master E2E & Finalisation (Sprint 12)
- **Établissement Témoin « DISTINCTION » (`src/lib/couture-distinction-provisioning.ts`, `migrations/20261002_couture_sprint12_distinction_demo_provisioning.sql`)** :
  - Provisionnement complet d'une maison de haute couture de référence à structure transfrontalière :
    - **6 Sites d'exploitation** : 1 Atelier Central à Lomé (Kodjoviakopé), 3 Boutiques à Lomé (Nyékonakpoè, Hôtel 2 Février, Agoè Minamadou), 2 Boutiques à Douala / Cameroun (Bonamoussadi, Bonapriso).
    - **49 Collaborateurs** :
      - Atelier Lomé (19) : 1 Chef d'atelier, 2 Coupeurs, 10 Couturiers, 5 Brodeurs (main et machine), 1 Magasinier atelier.
      - Boutiques Lomé (12) : 3 Chefs d'agence, 9 Vendeuses réparties sur les 3 boutiques.
      - Boutiques Douala (8) : 2 Chefs d'agence, 6 Vendeuses réparties sur Bonamoussadi et Bonapriso.
      - Administration Centrale (10) : 1 Comptable, 1 Directeur Marketing, 1 Directeur Communication, 1 Directeur RH, 1 Chargé des Achats, 2 Agents d'entretien, 3 Gardiens.
    - **Matrice Tarifaire des 6 Modèles phares Distinction** :
      - Goodluck (120k à 500k FCFA), Danshiki (150k à 700k FCFA), Agbada (300k à 900k FCFA), Abacost (250k à 900k FCFA), Robe (100k à 600k FCFA), Boubou (100k à 500k FCFA) sur les 4 gammes (Leader, VIP, Royale, Présidentiel).
      - Règle de confection Enfant à 50 % du tarif adulte applicable automatiquement.
    - **Plannings et Horaires de Travail Fixés** :
      - Boutiques : 9h-13h et 15h-21h du lundi au samedi, 10h-13h et 15h-19h le dimanche.
      - Administration : 8h-12h et 14h-18h du lundi au samedi, dimanche repos.
      - Atelier : 8h-11h, 12h-15h et 16h-20h du lundi au samedi, dimanche repos.
    - **Politique Salariale & Incitations Vendeurs** :
      - Points vendeurs (1 pt / 50 000 FCFA), seuil d'alerte sous 60 points/mois.
      - Prime gros achat (2 % si vente unitaire ≥ 1 000 000 FCFA).
      - Programme de fidélité clients VIP (remise trimestrielle de 2 % si dépenses ≥ 1 000 000 FCFA sur au moins 3 achats distincts).
      - Récompenses d'excellence annuelles (Voiture + carburant à 1600 pts et 3 ans d'ancienneté, Moto + carburant à 900 pts et 3 ans).
    - **Organisation Financière & Approvisionnements** :
      - Caisse atelier dotée d'un fonds de petite caisse de 20 000 FCFA (plafond unitaire de 2 000 FCFA).
      - Circuit d'achats à double niveau : signature comptable simple ≤ 50 000 FCFA, validation tripartite (Comptable + Promoteur + Magasinier) au-delà.
      - Plan comptable SYSCOHADA intégré à 28 comptes et 6 journaux dédiés (`VE`, `AC`, `BQ`, `CA`, `OD`, `PA`), avec consolidation multidevise automatique (Douala XAF / Lomé FCFA).
- **Route API Dédiée de Provisionnement (`POST /api/couture/demo/distinction`)** :
  - Déclenchement sécurisé réservé aux administrateurs DebitMaster (`system.manage` ou superadmin).
  - Validation idempotente de l'établissement témoin.
- **Suite de Validation E2E Master Intégrale (`tests/couture-sprint12-e2e-master-verification.test.mjs`)** :
  - 12 étapes de vérification couvrant la totalité du PRD Couture v1.0 :
    1. Structure des 6 sites et 49 employés.
    2. Catalogue & calcul des prix enfants.
    3. Cycle des 4 types de ventes (Prêt-à-porter, Sur-mesure, Confection, Retouche).
    4. Encaissement multidevise simultané (FCFA, USD, EUR, Mobile Money, TPE).
    5. Circuit de fabrication (FAB-YYYY-XXXXXX) et contrôle qualité d'atelier.
    6. Décompte de paie à la tâche des ouvriers avec majoration de 20 % hors horaires.
    7. Circuit d'achats de fournitures et gestion de la petite caisse.
    8. Stocks multi-sites, transferts inter-sites et inventaire physique avec écarts.
    9. Trésorerie multi-caisses et écritures comptables SYSCOHADA équilibrées.
    10. Présence géolocalisée (Haversine), paie mensuelle et incitations vendeurs.
    11. Tableaux de bord de pilotage par profil et analyse Pareto ABC.
    12. Étanchéité multi-tenant absolue par `tenant_id` et principe du moindre privilège.
- **Conformité AGENTS.md & Règles Sanctifiées** :
  - Zéro secret dans le code ou l'historique git.
  - 100 % RLS sur l'ensemble des tables publiques.
  - Zéro modification des composants sanctifiés d'Envol Africa Magazine (`Header.tsx`, `HeaderShell.tsx`).
  - Aucun calcul financier ou d'inventaire confié au client navigateur.

---

## 25. Refonte complète du système d'abonnement & tarification (PRD v1.1 — Sprints 1 à 7)
- **Objectif** : Unifier l'ensemble des abonnements autour des 6 activités indépendantes du SaaS (`BUVETTE`, `BAR_RESTAURANT`, `NIGHTCLUB_LOUNGE`, `HOTEL_AUBERGE`, `BOUTIQUE_COMMERCE`, `ATELIER_COUTURE`), avec tarif mensuel propre, réduction annuelle de 25 % (mensuel × 12 × 0,75), option spéciale à +50 % (×1,5), essai gratuit global de 30 jours et pilotage complet super-administrateur.
- **Sprint 1 : Sauvegarde & Modèle de Données** :
  - Sauvegarde exportée : `backups/backup_abonnements_pre_refonte_20261003.json` et miroir dans `SAUVEGARDE 02102026`.
  - Migration SQL maîtresse idempotente : `migrations/20261003_refonte_abonnements_prd_v1_1.sql` (dupliquée à la racine `A_EXECUTER_SQL_REFONTE_ABONNEMENTS_PRD_V1_1.sql`).
  - Tables créées : `plans_activite`, `parametres_globaux_abonnement`, `historique_prix_plans`, `abonnements_etablissement`.
  - Colonnes `companies` : `has_special_option` et `subscription_billing_period`, avec contrainte étendue sur les 6 activités.
  - Politiques RLS actives à 100 % avec révocation des accès directs anonymes/authentifiés non contrôlés.
- **Sprint 2 : Refonte de la Couche Logique d'Abonnement (`src/lib/subscription-plans.ts`)** :
  - Suppression intégrale des anciens plans Starter, Bar Restaurant Pro, Power et des formules Base/Moyenne/Semestrielle/Suprême.
  - Grille de référence officielle PRD v1.1 :
    - Buvette : 30 000 FCFA / mois (Annuel : 270 000 FCFA) · Spécial : 45 000 FCFA / mois (Annuel : 405 000 FCFA).
    - Bar et restaurant : 50 000 FCFA / mois (Annuel : 450 000 FCFA) · Spécial : 75 000 FCFA / mois (Annuel : 675 000 FCFA).
    - Boutique et commerce : 50 000 FCFA / mois (Annuel : 450 000 FCFA) · Spécial : 75 000 FCFA / mois (Annuel : 675 000 FCFA).
    - Lounge et night-club : 75 000 FCFA / mois (Annuel : 675 000 FCFA) · Spécial : 112 500 FCFA / mois (Annuel : 1 012 500 FCFA).
    - Hôtel et auberge : 80 000 FCFA / mois (Annuel : 720 000 FCFA) · Spécial : 120 000 FCFA / mois (Annuel : 1 080 000 FCFA).
    - Atelier de couture : 100 000 FCFA / mois (Annuel : 900 000 FCFA) · Spécial : 150 000 FCFA / mois (Annuel : 1 350 000 FCFA).
  - Période d'essai gratuite globale : fixée à 30 jours (suppression complète de toute mention 14 jours).
  - Helpers de compatibilité : `companyHasSpecialOption()` et `companyHasPowerFeatures()`.
- **Sprint 3 : Migration de l'Établissement Témoin BAR SANTE PLUS & Non-Régression** :
  - Identifiant réel migré : `f6afa300-7e9e-4891-b7f6-27ab69fc42d7` reclassé en `activity_type = 'BAR_RESTAURANT'`, plan `BAR_RESTAURANT_SPECIAL` (Option spéciale active).
  - Préservation intégrale sans régression des modules avancés (KDS repas/cuisine, lavage auto/moto, auberge/chambres, gym, tickets Wi-Fi, MoMo dédié) et de l'ensemble des comptes employés.
  - Gardes d'accès mises à niveau dans `DashboardShell.tsx` et routes `/api/power/*`.
- **Sprint 4 : Page Publique des Tarifs (`/tarifs`)** :
  - Création de `src/app/tarifs/page.tsx` et `TarifsClient.tsx`.
  - Affichage des 6 activités, sélecteur Mensuel/Annuel (-25%), commutateur par carte pour l'Option Spéciale (+50%), badge 30 jours d'essai gratuit et accordéon FAQ complet.
- **Sprint 5 : Mise à Jour du Landing Page (`src/app/LandingClient.tsx`)** :
  - Bandeau d'annonce révisé : 30 jours d'essai gratuit sans engagement sur les 6 activités.
  - Lien navbar redirigeant vers `/tarifs`.
  - Remplacement des 3 anciennes cartes par la grille responsive des 6 activités avec calcul dynamique des remises annuelles (-25%).
  - Encart de découverte des Options Spéciales (+50%) avec redirection vers `/tarifs`.
  - FAQ corrigée de 14 jours à 30 jours.
- **Sprint 6 : Espace Super-Administrateur (`/admin` & `/api/admin/pricing`)** :
  - Tableau de bord de pilotage des 6 activités avec édition des prix normaux, coefficients spéciaux, surcharges annuelles manuelles, toggles de disponibilité et descriptions d'options spéciales.
  - Carte de gestion des paramètres globaux (durée de l'essai gratuit, multiplicateur spécial par défaut, taux de réduction annuelle).
  - Journal d'audit traçant toutes les mutations tarifaires avec date, auteur et motif.
  - Bouton d'aperçu direct vers la page publique `/tarifs`.
- **Sprint 7 : Vérification & Recette Finale** :
  - Tests automatisés : 115 / 115 tests réussis (`npm test`).
  - Typecheck : zéro erreur TypeScript (`npx tsc --noEmit`).
  - Build de production : compilation et génération statique de 169 routes réussies avec Turbopack (`npm run build`).

---

## 15. Activité « Buvette » (Vente de Boissons Uniquement) & Établissement de Test

### 15.1. Périmètre Métier & Règles de l'Activité
- **Code d'activité** : `BUVETTE`.
- **Catalogue & Stocks** : Exclusivement des boissons (`BEVERAGE`). Toutes les fonctionnalités repas/cuisine, auberge, couture, gym et lavage sont strictement exclues et masquées.
- **Circuit Opérationnel des Boissons** :
  1. **Prise de commande** : Effectuée par la **Serveuse** sur mobile à la table du client.
  2. **Transmission & Préparation** : Transmise en direct au **Gérant** qui apprête les boissons au comptoir.
  3. **Livraison & Encaissement** : La serveuse livre les boissons fraîches à table et encaisse le règlement (Cash ou Mobile Money).
  4. **Fin de journée & Points** : La serveuse soumet son point journalier et ses encaissements au gérant (`server-remittances`), qui valide la conformité des fonds.
  5. **Approvisionnements** : Le **Chargé des approvisionnements** surveille les seuils d'alerte (bouteilles & casiers) et génère le bon d'approvisionnement (`supply_requests`) soumis au visa préalable du **Promoteur**.
  6. **Inventaire Journalier** : Le **Chargé des inventaires** effectue le contrôle physique journalier et la réconciliation des stocks (mécanisme identique à BAR SANTÉ PLUS).
  7. **Administration Promoteur** : Le **Promoteur (Propriétaire)** a les pleins droits d'administration : gestion de l'équipe, attribution des droits, validation des bons d'approvisionnement et supervision générale.

### 15.2. Différenciation des Formules (Option Normale vs Option Avancée / Spéciale)
- **Option Normale** (30 000 FCFA/mois — 270 000 FCFA/an) :
  - Jusqu'à **5 serveuses maximum** (contrôlé côté serveur dans l'API `/api/employees`).
  - **1 seul magasin de stockage** (contrôlé côté serveur dans l'API `/api/stock/stores`).
  - Jusqu'à **15 tables maximum** (contrôlé côté serveur dans l'API `/api/tables`).
  - Commande autonome QR code sur table **désactivée**.
  - Sessions Comptabilité (SYSCOHADA) et Trésorerie/Immobilisations **masquées**.
- **Option Avancée / Spéciale** (45 000 FCFA/mois — 405 000 FCFA/an) :
  - Serveuses, tables et magasins de stockage **illimités**.
  - Commande autonome par QR Code sur table **activée**.
  - Sessions Comptabilité SYSCOHADA et Trésorerie / Immobilisations **activées**.

### 15.3. Établissement Témoin Provisionné : « LA BUVETTE DU BON COIN »
- **Identifiant Unique** : `BUVBONCOIN`
- **Tenant ID** : `f3056be1-9180-49a9-84ce-1e216489df2a`
- **Données initiales** : 1 Magasin central (`Dépôt Boissons Central`), 10 tables, 6 références de boissons en stock casiers/bouteilles, essai gratuit 30 jours actif.
- **7 Comptes de Test Opérationnels** créés et vérifiés :
  1. `promoteur@buvette-boncoin.com` (Mathieu HOUNGBO — `ADMINISTRATEUR`)
  2. `gerant@buvette-boncoin.com` (Pascal AGBOSSOU — `GERANT`)
  3. `serveuse1@buvette-boncoin.com` (Yvette TOSSOU — `SERVEUSE`)
  4. `serveuse2@buvette-boncoin.com` (Justine AMOUZOU — `SERVEUSE`)
  5. `serveuse3@buvette-boncoin.com` (Chantal DOSSOU — `SERVEUSE`)
  6. `approvisionnement@buvette-boncoin.com` (Marcel LAWSON — `APPROVISIONNEMENT`)
  7. `inventaire@buvette-boncoin.com` (Félix AMEGATSE — `INVENTAIRE`)
- **Fichiers de données de test** enregistrés dans :
  - `C:\Users\EliteBook\NOUVEAUX PROJETS\SAUVEGARDE 02102026\donnees_test\COMPTES_TEST_BUVETTE.md`
  - `C:\Users\EliteBook\NOUVEAUX PROJETS\SAUVEGARDE 02102026\donnees_test\comptes_test_buvette.json`
  - Miroir dans `debitmaster/donnees_test/`.





















