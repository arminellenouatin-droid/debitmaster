# Répertoire des Comptes de Test — Établissement « LA BUVETTE DU BON COIN »

> **Établissement** : LA BUVETTE DU BON COIN  
> **Code Unique Établissement** : `BUVBONCOIN`  
> **Activité** : `BUVETTE` (Vente de boissons uniquement — bières, sodas, eaux minérales, jus)  
> **Formule souscrite** : Option Normale (30 000 FCFA / mois — 270 000 FCFA / an)  
> **Période d'essai** : Essai gratuit 30 jours actif  
> **Devise d'exploitation** : Franc CFA (XOF / FCFA)  
> **Pays** : Togo (`TG`)  
> **Structure opérationnelle** : 1 Magasin central de boissons, 10 Tables (Terrasse & Salle)  
> **Effectif de test** : 7 Collaborateurs opérationnels configurés et authentifiés  

---

## 1. Périmètre Métier & Règles de l'Activité « Buvette »

L'activité **Buvette** est strictement dédiée au débit de boissons :
- **Boissons uniquement** : Le catalogue articles, les commandes et les stocks sont restreints à la famille `BEVERAGE` (bières, sodas, eaux, liqueurs, jus). Les modules repas/cuisine, auberge/hébergement, pressing, couture ou gym sont strictement exclus.
- **Circuit de commande des boissons** :
  1. La **Serveuse** prend la commande client sur mobile/tablette à table.
  2. La commande est transmise en temps réel au **Gérant**.
  3. Le **Gérant** prépare les boissons depuis le comptoir/dépôt et valide la mise à disposition.
  4. La **Serveuse** récupère les boissons, les livre à la table et procède à l'encaissement (Espèces ou Mobile Money).
- **Fin de journée & Points de caisse** : La serveuse soumet ses reversements et son point de vente quotidien au Gérant (`server-remittances`), qui valide la conformité des fonds remis.
- **Approvisionnements & Alertes** : Le **Chargé des approvisionnements** suit les stocks minimums, seuils d'alerte (bouteilles et casiers) et génère les bons d'approvisionnement soumis à l'approbation du **Promoteur** avant tout achat fournisseur.
- **Inventaire Journalier** : Le **Chargé des inventaires** réalise le comptage physique journalier, détecte les écarts (casses, manquants) et procède à la réconciliation des stocks physiques (identique au modèle BAR SANTÉ PLUS).
- **Supervision Promoteur** : Le **Promoteur (Propriétaire)** dispose des pleins droits d'administration : gestion de l'équipe, attribution des droits, validation des bons d'approvisionnement, configuration de l'établissement et reporting global.

---

## 2. Différenciation des Options (Normale vs Avancée / Spéciale)

| Fonctionnalité / Règle | Option Normale (Actuelle) | Option Avancée / Spéciale |
|---|---|---|
| **Tarif Mensuel** | **30 000 FCFA** | **45 000 FCFA** (x1,5) |
| **Tarif Annuel (-25%)** | **270 000 FCFA** | **405 000 FCFA** |
| **Nombre maximum de Serveuses** | **5 serveuses maximum** | **Illimité** |
| **Nombre maximum de Magasins** | **1 seul magasin / dépôt** | **Illimité** (dépôt principal, bar terrasse, réserve) |
| **Nombre maximum de Tables** | **15 tables maximum** | **Illimité** |
| **Commande autonome QR Code sur table** | ❌ Désactivée (prise de commande par serveuse) | ✅ **Activée** (le client scanne et commande seul) |
| **Session Comptabilité (SYSCOHADA)** | ❌ Masquée | ✅ **Activée** (journaux VE, AC, BQ, CA, balance) |
| **Session Trésorerie & Immobilisations** | ❌ Masquée | ✅ **Activée** (suivi trésorerie, caisse, amortissements) |

---

## 3. Tableau des 7 Comptes de Test Opérationnels

Tous les comptes ci-dessous ont été provisionnés, vérifiés et validés dans la base de données de production/staging.

| N° | Nom & Prénom | Profil Métier | Rôle RBAC | Email de Connexion | Téléphone (E.164) | Mot de Passe de Test | Droits & Attributions Clés |
|---|---|---|---|---|---|---|---|
| **01** | **Mathieu HOUNGBO** | Promoteur / Propriétaire | `ADMINISTRATEUR` | `promoteur@buvette-boncoin.com` | `+22892000001` | `BuvetteBonCoin2026!Pro#01` | Pleins droits, création du personnel, validation bons d'approvisionnement, dashboard de pilotage, facturation SaaS |
| **02** | **Pascal AGBOSSOU** | Gérant d'exploitation | `GERANT` | `gerant@buvette-boncoin.com` | `+22892000002` | `BuvetteBonCoin2026!Ger#02` | Préparation boissons au comptoir, remise au service, validation points journaliers serveuses, gestion tables, vue stock comptoir |
| **03** | **Yvette TOSSOU** | Serveuse (Responsable Rang 1) | `SERVEUSE` | `serveuse1@buvette-boncoin.com` | `+22892000003` | `BuvetteBonCoin2026!Srv#03` | Prise de commande boissons sur table, réception, livraison, encaissement (Cash/MoMo), soumission du point journalier au gérant |
| **04** | **Justine AMOUZOU** | Serveuse (Rang 2) | `SERVEUSE` | `serveuse2@buvette-boncoin.com` | `+22892000004` | `BuvetteBonCoin2026!Srv#04` | Prise de commande mobile boissons, suivi des tables actives, livraison boissons fraîches, clôture de service |
| **05** | **Chantal DOSSOU** | Serveuse (Terrasse) | `SERVEUSE` | `serveuse3@buvette-boncoin.com` | `+22892000005` | `BuvetteBonCoin2026!Srv#05` | Prise de commande mobile boissons terrasse, encaissement, remise de fonds quotidienne |
| **06** | **Marcel LAWSON** | Chargé des approvisionnements | `APPROVISIONNEMENT` | `approvisionnement@buvette-boncoin.com` | `+22892000006` | `BuvetteBonCoin2026!App#06` | Suivi des alertes de stock (bouteilles & casiers), élaboration des bons d'approvisionnement, soumission au promoteur, réception livraisons |
| **07** | **Félix AMEGATSE** | Chargé des inventaires | `INVENTAIRE` | `inventaire@buvette-boncoin.com` | `+22892000007` | `BuvetteBonCoin2026!Inv#07` | Contrôle journalier des stocks physiques boissons, détection des casses/écarts, validation inventaire, conformité modèle BAR SANTÉ PLUS |

---

## 4. Catalogue Initial des Boissons & Stocks

| Réf. Boisson | Format & Conditionnement | Prix Vente Détail | Seuil d'Alerte | Stock Initial Dépôt |
|---|---|---|---|---|
| **Bière Castel 65cl** | Bouteille verre (Casier de 12) | 700 FCFA | 24 btles (2 casiers) | 120 bouteilles (10 casiers) |
| **Bière Beaufort Lager 50cl** | Bouteille verre (Casier de 12) | 800 FCFA | 24 btles (2 casiers) | 96 bouteilles (8 casiers) |
| **Guinness Foreign Extra 33cl** | Bouteille verre (Casier de 24) | 900 FCFA | 24 btles (1 casier) | 72 bouteilles (3 casiers) |
| **Coca-Cola 33cl Verre** | Bouteille verre (Casier de 24) | 500 FCFA | 24 btles (1 casier) | 144 bouteilles (6 casiers) |
| **Fanta Orange 33cl Verre** | Bouteille verre (Casier de 24) | 500 FCFA | 24 btles (1 casier) | 96 bouteilles (4 casiers) |
| **Eau Minérale Possotomé 1.5L** | Bouteille PET (Pack de 6) | 600 FCFA | 12 btles (2 packs) | 60 bouteilles (10 packs) |

---

## 5. Guide Pas-à-Pas des Scénarios de Test Opérationnels

### Scénario 1 : Prise de Commande Boisson -> Préparation Gérant -> Livraison Serveuse -> Encaissement
1. **Connexion Serveuse** :
   - Se connecter avec `serveuse1@buvette-boncoin.com` (`BuvetteBonCoin2026!Srv#03`).
   - L'interface s'ouvre sur la prise de commande mobile (`ServeurClient`).
   - Sélectionner la **Table 3** (Terrasse).
   - Ajouter : 2x Bière Castel 65cl (1 400 FCFA) + 1x Eau Minérale Possotomé 1.5L (600 FCFA). Total : 2 000 FCFA.
   - Valider la commande. La commande passe à l'état `PENDING`.
2. **Notification & Préparation par le Gérant** :
   - Se connecter dans un autre onglet/navigateur avec `gerant@buvette-boncoin.com` (`BuvetteBonCoin2026!Ger#02`).
   - Dans le tableau de bord du Gérant, la nouvelle commande boisson pour la Table 3 apparaît.
   - Le gérant sort les boissons du frigo/comptoir et clique sur **« Préparer »** (`PREPARING`) puis **« Prêt pour service »** (`READY`).
3. **Livraison & Encaissement par la Serveuse** :
   - La serveuse reçoit l'indication de commande prête.
   - Elle sert le client à la Table 3 et clique sur **« Livré »** (`DELIVERED`).
   - Le client paie 2 000 FCFA en espèces.
   - La serveuse enregistre le paiement : la commande est marquée **Payée** (`status: COMPLETED`).

---

### Scénario 2 : Clôture de Journée & Point de Vente de la Serveuse au Gérant
1. **Fin de shift de la Serveuse** :
   - Se connecter avec `serveuse1@buvette-boncoin.com`.
   - Accéder à la section **« Mes Remises / Clôture Serveuse »** (`/dashboard/server-remittances` ou clôture journalière).
   - Constater le montant total encaissé sur le shift (ex. 25 000 FCFA espèces).
   - Cliquer sur **« Soumettre le point au Gérant »**.
2. **Validation par le Gérant** :
   - Se connecter avec `gerant@buvette-boncoin.com`.
   - Consulter la liste des remises en attente.
   - Vérifier le montant physique en espèces remis par Yvette TOSSOU et valider le point (`VALIDATED`).
   - Le statut de la serveuse pour la journée passe en clôturé sans écart.

---

### Scénario 3 : Suivi Alerte Stock, Bon d'Approvisionnement & Visa du Promoteur
1. **Constat du Stock d'Alerte** :
   - Se connecter avec `approvisionnement@buvette-boncoin.com` (`BuvetteBonCoin2026!App#06`).
   - Consulter la liste des stocks. Si la Guinness ou le Beaufort s'approche du seuil d'alerte (24 bouteilles) :
2. **Émission du Bon d'Approvisionnement** :
   - Cliquer sur **« Nouvelle demande d'approvisionnement »** (`supply_requests`).
   - Sélectionner :
     * 5 casiers de Guinness Foreign Extra 33cl (120 bouteilles).
     * 5 casiers de Bière Castel 65cl (60 bouteilles).
   - Indiquer le fournisseur habituel (ex. Brasserie BB Lomé) et la justification.
   - Soumettre la demande : elle prend le statut `PENDING_APPROVAL`.
3. **Approbation par le Promoteur** :
   - Se connecter avec `promoteur@buvette-boncoin.com` (`BuvetteBonCoin2026!Pro#01`).
   - Accéder aux demandes d'approvisionnement dans le menu Stocks / Achats.
   - Examiner les quantités demandées et cliquer sur **« Approuver »** (`APPROVED`).
4. **Réception des Boissons** :
   - Une fois la livraison livrée par la brasserie, Marcel LAWSON (`APPROVISIONNEMENT`) confirme la réception physique : les stocks du `Dépôt Boissons Central` sont automatiquement incrémentés.

---

### Scénario 4 : Contrôle Journalier Physique des Stocks & Réconciliation
1. **Comptage Physique** :
   - Se connecter avec `inventaire@buvette-boncoin.com` (`BuvetteBonCoin2026!Inv#07`).
   - Accéder au module de **« Contrôle Journalier des Stocks »** (`daily_stock_controls` / audit des stocks).
   - Saisir les comptages physiques relevés en fin de journée pour chaque référence de boisson dans le magasin central.
2. **Détection d'Écart & Justification** :
   - Si un écart est relevé (ex. 1 bouteille de Castel cassée au service) :
   - Indiquer le motif : `Casse / Déprédation au comptoir`.
   - Enregistrer le contrôle : le système calcule l'écart théorique vs réel.
3. **Clôture Journalière des Stocks** :
   - Valider la réconciliation journalière (`inventory.validate`, `reports.daily_close`).
   - Le registre des mouvements est figé et consultable dans l'historique d'audit par le Promoteur.

---

### Scénario 5 : Vérification des Quotas Option Normale vs Option Spéciale
1. **Test des Limites Option Normale (Actives sur l'établissement test)** :
   - Se connecter avec le Promoteur (`promoteur@buvette-boncoin.com`).
   - **Test Quota Serveuses** : L'établissement compte actuellement 3 serveuses. Tenter d'en créer jusqu'à 5 (autorisé). Tenter d'ajouter une 6e serveuse : le système rejette la création avec le message explicite : *« La formule normale Buvette est limitée à 5 serveuses au maximum. Passez à l'option spéciale pour un nombre illimité. »*
   - **Test Quota Magasins** : Tenter d'ajouter un second magasin de stock : rejeté avec l'alerte *« La formule normale Buvette est limitée à 1 magasin de stockage. »*
   - **Test Quota Tables** : Tenter de dépasser 15 tables : rejeté dès la 16e table.
   - **Test QR Code Autonome** : Le lien de menu public QR code est désactivé.
   - **Test Sessions Comptabilité & Finance** : Les onglets Comptabilité SYSCOHADA et Trésorerie/Immobilisations sont masqués dans la navigation.
2. **Surclassement en Option Spéciale (Simulation)** :
   - Si le Promoteur met à niveau son abonnement vers **Buvette — Option Spéciale (45 000 FCFA/mois)** :
   - Les quotas de serveuses, tables et magasins deviennent illimités.
   - Le module de commande QR Code sur table est activé (les clients scannent et commandent directement).
   - Les sessions complètes de Comptabilité SYSCOHADA et de Trésorerie/Immobilisations deviennent accessibles.
