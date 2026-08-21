# Cahier des charges complet — DebitManager (Bar Maquis Master)

**Projet :** DebitManager (Bar Maquis Master) — Application SaaS mobile & web de gestion de bars, maquis, restaurants, boîtes de nuit et lounges
**Version :** 1.0
**Destinataires :** Agents IA de développement (conception, backend, frontend, mobile, DevOps, QA)
**Objectif du document :** Fournir une spécification exhaustive, non ambiguë et actionnable permettant la réalisation intégrale du projet de A à Z, sans zone d'ombre.

## Sommaire

1. Présentation générale du projet
2. Objectifs et vision produit
3. Utilisateurs cibles et personas
4. Architecture technique recommandée
5. Modèle de données (entités et relations)
6. Modules fonctionnels détaillés
7. Parcours utilisateurs (user flows) complets
8. Gestion des abonnements, facturation et Dashboard Super-Admin plateforme
9. Paiements (clients, salaires, trésorerie)
10. Notifications et communication interne
11. Internationalisation (langue, devise, pays)
12. Sécurité et conformité
13. Mode hors-ligne et synchronisation
14. Design système (UI/UX)
15. Exigences non-fonctionnelles
16. Rôles et matrice de permissions
17. KPIs et tableaux de bord
18. Plan de développement par phases (sprints)
19. Critères d'acceptation (Definition of Done)
20. Livrables attendus
21. Annexes (glossaire, exemples de données)

---

## 1. Présentation générale du projet

DebitManager est une application mobile (Android/iOS) et web responsive, fonctionnant en mode SaaS par abonnement, permettant à tout exploitant de bar, maquis, restaurant, boîte de nuit ou lounge de gérer intégralement son établissement : stocks, ventes, personnel, présences, paie, approvisionnements, trésorerie, comptabilité et pilotage par indicateurs (KPI).

Le logiciel doit être :

- **Ultra-simple d'utilisation**, y compris pour des utilisateurs analphabètes (usage massif d'icônes, de couleurs, de confirmations vocales/sonores et d'un minimum de texte à lire)
- **Élégant et moderne** dans son design
- **Mobile-first** mais totalement responsive sur tablette et web
- **Robuste en connexion instable** (contexte Afrique de l'Ouest)
- **Multilingue et multi-devise**, avec détection automatique du pays

### 1.1 Nom, identité visuelle

- Nom de l'application : **DebitManager**
- Logo et charte graphique : à créer (voir section 14 — Design système). Livrer : logo (SVG + PNG, versions couleur/monochrome/inversée), palette de couleurs, typographies, favicon, icône d'application (toutes résolutions iOS/Android).

## 2. Objectifs et vision produit

- Digitaliser l'ensemble des opérations d'un débit de boissons/restaurant/boîte de nuit sur une seule plateforme
- Réduire les pertes (stocks, fraude, erreurs de caisse)
- Fournir une visibilité temps réel sur les ventes, la trésorerie et la performance du personnel
- Automatiser la paie, les présences et les réapprovisionnements
- Permettre un paiement client fluide (espèces, carte, mobile money)
- Générer des revenus récurrents via abonnement + commission sur transactions (1%)

## 3. Utilisateurs cibles et personas

| Persona | Description | Besoin principal |
|---|---|---|
| Exploitant/Promoteur | Propriétaire du bar/restaurant | Vue globale, trésorerie, KPI, validation paie |
| Administrateur | Gère la configuration au quotidien | Paramétrage complet, droits, personnel |
| Gérant/Superviseur | Responsable opérationnel sur site | Supervision temps réel, validation retards |
| Serveur/Serveuse | Prend les commandes | Simplicité extrême, rapidité, offline |
| Bar man | Prépare les boissons | File d'attente des commandes bar |
| Cuisinier/Chef cuisine | Prépare les plats | File d'attente cuisine (KDS), attribution |
| Magasinier | Gère stocks physiques | Inventaire, alertes stock |
| Chargé des approvisionnements | Commande auprès fournisseurs | Bons de commande, suivi livraisons |
| Comptable | Gère finances et paie | Rapports, paie, dépenses, factures |
| Secrétaire | Support administratif | Accès limité configurable |
| Client final | Consomme au bar/restaurant | Paiement rapide, facture, QR menu |
| Super-Admin (équipe DebitManager) | Éditeur de la plateforme, non rattaché à une boutique | Vue globale sur toutes les boutiques, transactions, revenus (abonnements + commissions), supervision et administration totale du système |
| Affilié (partenaire promotionnel) | Toute personne faisant la promotion de DebitManager, non rattachée à une boutique | Lien de parrainage, suivi des boutiques parrainées, gains sur abonnements, demande de retrait |

## 4. Architecture technique recommandée

### 4.1 Stack proposée

- **Frontend mobile :** Flutter (un seul code base iOS + Android), pour cohérence UI et performance offline-first
- **Frontend web (dashboard admin/comptable) :** React + TypeScript, avec design system partagé (voir section 14)
- **Backend :** Node.js (NestJS) ou alternative équivalente, API REST + WebSocket (pour le temps réel : notifications de commande, présence, alertes stock)
- **Base de données :** PostgreSQL (données transactionnelles) + Redis (cache, files d'attente, sessions)
- **Synchronisation offline :** base locale embarquée sur mobile (SQLite chiffré) avec moteur de synchronisation différée et résolution de conflits (dernier écrit gagne + horodatage serveur faisant foi pour la trésorerie)
- **Stockage fichiers :** service de stockage objet (S3-compatible) pour logos, photos produits, factures PDF
- **Notifications push :** service de push cross-plateforme (Firebase Cloud Messaging / APNs) + fallback SMS
- **Hébergement :** infrastructure cloud avec réplication multi-zone, sauvegardes automatiques quotidiennes chiffrées, rétention 90 jours minimum
- **Multi-tenant :** isolation stricte des données par entreprise (tenant_id sur toutes les tables), option d'isolation physique pour gros comptes

### 4.2 Intégrations tierces

- Agrégateurs de paiement : **Kkiapay, Moneroo, Cinetpay** (webhooks de confirmation obligatoires + réconciliation automatique)
- Service de géolocalisation (pour badgeage présence)
- Service d'envoi d'e-mails transactionnels (factures, notifications)
- Service SMS (fallback notifications pour téléphones basiques)
- Détection pays/langue/devise via IP + paramètres téléphone, avec possibilité de forcer manuellement

## 5. Modèle de données (entités principales)

Entités clés à modéliser (liste non exhaustive, les agents doivent compléter le schéma relationnel détaillé lors de la conception technique) — **le schéma de référence complet est figé dans `data-model.md`** :

- **Company (Entreprise/Boutique)** : nom, type d'activité (buvette/bar-restaurant/boîte de nuit), code société unique, pays, devise, langue, statut abonnement, date d'expiration
- **Subscription (Abonnement)** : formule, montant, période, date début/fin, statut (actif/expiré/en grâce/suspendu), historique des paiements
- **User (Utilisateur)** : nom, prénom, téléphone, email, mot de passe (hashé), rôle, statut, entreprise rattachée
- **Role/Permission** : liste des droits activables/désactivables par profil
- **Employee (Employé)** : lié à User, poste, planning, taux horaire/salaire, coordonnées bancaires/mobile money, statut de présence
- **Schedule (Planning)** : jours, heures de début/fin, exceptions
- **Attendance (Présence)** : horodatage connexion, localisation GPS, statut (à l'heure/retard/absent/exception)
- **Product (Produit)** : nom, catégorie, type, unité, prix, stock actuel, seuil d'alerte, seuil de sécurité
- **Category/Type/Unit** : listes préconfigurées extensibles (bières, sucreries, énergisantes, spiritueux, repas… ; 33cl, 50cl, 60cl, 1L, champagnes, vins, whisky, autres spiritueux, petit-déjeuner, accompagnement, poissons, viande, résistance, jus de fruits naturels, dessert ; bouteilles, plats, conso, dose, tasse, unité)
- **Stock/Inventory** : mouvements de stock, inventaires physiques périodiques, écarts calculés
- **Supplier (Fournisseur)** : coordonnées, historique commandes, délais de livraison
- **PurchaseOrder (Bon de commande)** : produits, quantités, fournisseur, statut de validation
- **Table (Table de salle)** : numéro, zone, statut (libre/occupée/réservée), capacité
- **Order (Commande)** : table, serveur, articles, statut (en attente/en préparation/prête/livrée/payée), section concernée (bar/cuisine)
- **OrderItem (Ligne de commande)** : produit, quantité, prix, section assignée, cuisinier/barman assigné
- **Invoice (Facture)** : commande, montant, mode de paiement, statut, PDF, numéro légal séquentiel
- **Payment (Paiement)** : montant, mode (espèces/carte/mobile money), statut, référence agrégateur, commission plateforme
- **Payroll (Paie)** : employé, période, montant, primes, retenues, statut validation, mode de paiement
- **Treasury (Trésorerie)** : mouvements de fonds, retraits, soldes disponibles par mode de paiement
- **Notification/Message** : expéditeur, destinataires (individuel/groupe), contenu, statut lu/répondu
- **AuditLog (Journal d'audit)** : utilisateur, action, entité concernée, horodatage, IP
- **Affiliate (Affilié)** : nom, prénom, téléphone, email, coordonnées de paiement (mobile money/virement), code affilié unique, lien de parrainage, statut (en attente/actif/suspendu), taux de commission applicable
- **ReferralTracking (Suivi de parrainage)** : affilié, boutique parrainée (une fois inscrite), date du clic, date d'inscription, source du lien
- **AffiliateCommission (Commission d'affiliation)** : affilié, boutique parrainée, abonnement/paiement concerné, montant, statut (en attente/validée/versée/rejetée)
- **AffiliatePayout (Versement affilié)** : affilié, montant, période couverte, statut, référence de paiement, date de versement

## 6. Modules fonctionnels détaillés

### 6.1 Inscription et gestion de compte

**Étape 1 — Inscription générale (tous profils) :**

- Téléphone, nom, prénom, email + option de connexion via réseaux sociaux (Google, Facebook, Apple)
- Vérification du téléphone par code OTP obligatoire
- Choix : « Créer une boutique » ou « Rejoindre une boutique en tant qu'employé »

**Étape 2a — Parcours Exploitant :**

1. Choix du type d'activité (buvette / bar-restaurant / boîte de nuit-lounge)
2. Saisie des informations de l'entreprise (nom commercial, adresse, logo optionnel, pays — détecté automatiquement mais modifiable)
3. Génération automatique d'un **code société unique** (utilisé par les employés pour rejoindre)
4. Redirection vers le choix de la formule d'abonnement — **aucune fonctionnalité de configuration accessible tant que l'abonnement n'est pas activé**
5. Paiement de l'abonnement via Kkiapay/Moneroo/Cinetpay
6. Une fois payé : déblocage complet du dashboard de configuration (personnel, plannings, stocks/prix, espaces de travail/tables)
7. **Période d'essai gratuite** de 14 jours proposée à la première inscription, avec fonctionnalités complètes limitées dans le temps, sans obligation de carte bancaire immédiate

**Étape 2b — Parcours Employé :**

1. Saisie du code société fourni par l'exploitant
2. Message d'attente affiché : « Inscription en attente de validation »
3. L'administrateur/promoteur reçoit une alerte en temps réel avec les informations du candidat
4. Validation manuelle : attribution du rôle, des droits, génération d'un mot de passe temporaire envoyé par email/SMS
5. Alternative : l'administrateur crée directement le compte employé depuis son dashboard (pas d'inscription nécessaire côté employé, il reçoit directement ses identifiants)
6. Connexion de l'employé → accès à son espace configuré selon ses droits, tant que le compte de la société est actif

**Gestion du cycle de vie de l'abonnement :**

- Rappels automatiques avant expiration (J-7, J-3, J-1)
- Période de grâce de 3 jours après expiration (accès en lecture seule, pas de nouvelles commandes) avant suspension complète
- Historique complet des paiements d'abonnement consultable
- Changement de formule (upgrade/downgrade) avec calcul au prorata

### 6.2 Gestion des types d'activité et tarification

| Activité | Coefficient tarifaire | Produits inclus |
|---|---|---|
| Buvette | x1 (formules de base : 50k / 130k / 240k / 400k XOF) | Bières, sucreries, énergisantes |
| Bar-restaurant | x1,5 | + repas et plats |
| Boîte de nuit / Lounge | x2 | + champagnes, spiritueux, vins |

- Catégories, types et unités préconfigurés (voir section 5) mais **extensibles** par chaque exploitant depuis son dashboard
- Configuration des prix par produit, avec historique des changements de prix

### 6.3 Gestion des produits, stocks et approvisionnements

- Ajout/modification/suppression de produits avec catégorie, type, unité, prix, image
- Définition de **seuil d'alerte** et **seuil de sécurité** par produit
- Notification automatique (au chargé d'approvisionnement, comptable, exploitant) dès qu'un seuil d'alerte est atteint
- Le chargé d'approvisionnement sélectionne les produits à commander → génère un **bon de commande** → soumis à validation du comptable ou du promoteur → commande envoyée au fournisseur
- **Fiches fournisseurs** : coordonnées, historique des commandes, délais moyens de livraison, comparatif de prix
- **Inventaire physique périodique** : fréquence configurable par l'administrateur ; saisie des quantités réelles ; le système calcule automatiquement les écarts (théorique vs réel) et génère un rapport d'analyse avec interprétation (perte, vol probable, erreur de saisie)
- Gestion des pertes/casse/péremption avec motif et responsable

### 6.4 Gestion des tables et espaces de travail

- Configuration du plan de salle : zones, tables, capacité
- Statut de chaque table en temps réel : libre / occupée / réservée / à nettoyer
- Réservation de table (date, heure, nombre de couverts, contact client)
- Transfert de commande entre tables
- Fusion/scission de tables pour grands groupes
- **Commande autonome par QR code** : le client scanne un QR sur sa table, consulte le menu digital, peut commander directement (option activable/désactivable par l'exploitant), la commande arrive alors comme une commande serveur classique

### 6.5 Processus de commande et livraison

1. Le serveur prend la commande sur son téléphone (fonctionne **hors-ligne**, synchronisation automatique dès reconnexion)
2. La commande est automatiquement ventilée par section (bar, cuisine) — chaque section ne voit que ce qui la concerne
3. Le barman/chef cuisine reçoit la commande, l'attribue à un exécutant disponible (le chef cuisine attribue à un cuisinier)
4. Bouton « Commande prête » → notification automatique au serveur (et au livreur si besoin)
5. Le serveur/livreur retire la commande, valide « Commande reçue », livre au client
6. En fin de service : présentation de la facture (affichage écran, envoi email, ou impression thermique Bluetooth/WiFi)
7. **Modes de paiement :**
   - **Espèces** : le serveur valide le règlement manuellement dans l'app
   - **Mobile money** : saisie du numéro → demande de validation envoyée sur le téléphone du client → confirmation → facture PDF + notification envoyées automatiquement
   - **Carte bancaire** : client renseigne email/nom/téléphone → reçoit un lien de paiement sécurisé (hébergé par l'agrégateur, DebitManager ne stocke jamais les données de carte) → validation → facture PDF + notification
8. **Split billing** : possibilité de diviser l'addition entre plusieurs convives ou plusieurs modes de paiement
9. **Pourboires** : possibilité d'ajouter un pourboire lors du paiement, crédité au serveur concerné
10. **Annulation/remboursement** : workflow de demande d'annulation avec motif, validation par un superviseur, traçabilité complète dans le journal d'audit

### 6.6 Gestion des présences (badgeage)

- Plannings définis par employé (jours, horaires)
- Connexion au système = badgeage automatique
- **Contrainte de géolocalisation** : la connexion n'est validée que si la position GPS du téléphone correspond au lieu de travail enregistré (rayon configurable) — sauf exception accordée par un superviseur
- Si le téléphone change de localisation pendant le service au-delà d'un temps défini : déconnexion automatique (sauf exception)
- Retard de 10 minutes après l'heure prévue → marqué « en retard »
- Retard de plus de 30 minutes → connexion bloquée, nécessite l'autorisation d'un superviseur, sinon marqué « absent » pour la journée
- Historique complet des présences, retards, absences, exceptions accordées (avec motif et auteur de l'exception)
- Gestion des congés et demandes d'absence autorisée (workflow de demande/validation)

### 6.7 Gestion du personnel et des rôles

**Profils prédéfinis :** Serveur/Serveuse, Superviseur, Magasinier, Gérant, Bar man, Secrétaire, Comptable, Chargé des approvisionnements, Cuisinier, Chef cuisine, Administrateur

- Le promoteur peut créer des profils personnalisés supplémentaires
- Chaque droit d'utilisation du logiciel est un interrupteur (activé/désactivé) au sein de la configuration du profil
- Le dashboard et l'espace de travail de chaque utilisateur sont générés automatiquement selon ses droits (aucune fonctionnalité non autorisée n'est visible, pas seulement grisée)
- Fiche employé : documents (contrat, pièce d'identité — stockage sécurisé), coordonnées bancaires/mobile money, historique disciplinaire

### 6.8 Trésorerie et comptabilité

- Vue consolidée des fonds pour le promoteur et le comptable, par mode de paiement (espèces/carte/mobile money)
- Retrait des fonds (carte/mobile money) directement vers mobile money de l'exploitant
- **Commission plateforme de 1%** prélevée automatiquement sur les transactions carte/mobile money, avec reporting transparent
- Module de comptabilité complet : dépenses, achats, rapprochement bancaire, export comptable (CSV/Excel/PDF)
- Génération de rapports périodiques imprimables (journalier, hebdomadaire, mensuel, annuel)
- Conformité fiscale locale : calcul de la TVA/taxes applicables selon le pays, **numérotation légale séquentielle des factures**, mentions légales obligatoires sur facture

### 6.9 Gestion de la paie

- Le comptable prépare la paie mensuelle par employé (salaire de base, primes, retenues, heures supplémentaires)
- Validation obligatoire par le promoteur avant paiement
- Notification de paie envoyée à chaque employé sur son téléphone
- Paiement de salaire directement via mobile money, avec option virement bancaire
- **Système de primes** : suggestions automatiques de primes basées sur la performance (meilleur vendeur, assiduité, zéro écart d'inventaire…), configurables par l'administrateur
- Historique complet des paies, bulletins de salaire téléchargeables en PDF

### 6.10 Communication interne

- L'administrateur/superviseur peut envoyer des messages à des groupes de personnel ou individuellement
- Les destinataires peuvent répondre ou simplement recevoir en notification (configurable par message)
- Historique des communications par groupe/canal
- Notifications push + fallback SMS pour les téléphones basiques ou en cas d'échec de la notification push

### 6.11 KPI et tableaux de bord

- **Administrateur/Promoteur** : chiffre d'affaires (jour/semaine/mois/année), ventes par catégorie de produit, taux d'occupation des tables, performance par employé, écarts d'inventaire, trésorerie consolidée, taux de retard/absentéisme, comparatif entre boutiques (si multi-sites)
- **Serveur** : ses ventes, son classement (meilleur vendeur), ses commandes en cours/historique, ses présences
- **Comptable** : trésorerie, dépenses, paie en cours, factures impayées
- **Magasinier/Chargé approvisionnement** : stocks critiques, commandes en cours, écarts d'inventaire
- Export de tous les rapports en PDF/Excel, impression directe

### 6.12 Système d'affiliation

**Principe général**

- Toute personne (particulier, influenceur, apporteur d'affaires, partenaire…) peut s'inscrire en tant qu'**affilié** depuis un formulaire public, sans avoir besoin de posséder ou gérer une boutique
- Génération automatique, à l'inscription, d'un **code affilié unique** et d'un **lien de parrainage unique** (partageable sur réseaux sociaux, site web, WhatsApp, etc.)
- Tout exploitant qui s'inscrit via ce lien (tracking automatique) ou en renseignant le code lors de son inscription est rattaché **de façon permanente** à l'affilié correspondant

**Inscription et validation de l'affilié**

- Formulaire public : nom, prénom, téléphone, email, coordonnées de paiement pour recevoir ses gains (mobile money/virement)
- Acceptation de CGU d'affiliation spécifiques (comportements interdits : spam, fausses promesses, auto-parrainage)
- Validation configurable depuis le Super-Admin : automatique (accès immédiat) ou manuelle (revue avant activation), pour limiter la fraude

**Suivi et attribution des parrainages**

- Attribution au premier lien cliqué ou premier code saisi, définitive et non modifiable après coup (sauf intervention exceptionnelle du Super-Admin)
- Durée de vie du tracking (cookie/identifiant) configurable, pour couvrir les inscriptions différées après un clic
- Traçabilité complète et horodatée : clic → inscription exploitant → activation du premier abonnement payant

**Calcul des commissions**

- Commission calculée en **pourcentage configurable par le Super-Admin** sur les paiements d'abonnement (uniquement — distincte de la commission plateforme de 1% prélevée sur les transactions clients des boutiques)
- Mode configurable globalement (et surchargeable par affilié si besoin) : commission **sur le premier paiement uniquement**, ou **récurrente** sur chaque renouvellement tant que la boutique parrainée reste abonnée et active
- Possibilité de barème par palier configurable (le taux augmente selon le nombre de boutiques actives parrainées), non obligatoire, activable par le Super-Admin
- Une commission n'est validée (passage en solde disponible) qu'une fois le paiement de la boutique effectivement confirmé, avec délai de sécurité configurable (couverture des remboursements)

**Espace/dashboard affilié**

- Vue d'ensemble : nombre de boutiques parrainées (en essai/actives/résiliées), historique des clics et inscriptions
- Détail des gains : par boutique, par mois, cumulés, montant en attente de validation, montant disponible, montant déjà versé
- Outils de partage : lien court personnel, QR code généré automatiquement, visuels/bannières prêtes à l'emploi
- Demande de retrait des gains disponibles vers mobile money/virement (seuil minimum de retrait configurable par le Super-Admin), avec suivi du statut (en attente/traité/rejeté)

**Gestion du programme depuis le Super-Admin**

- Vue globale de tous les affiliés : identité, statut, nombre de boutiques parrainées, chiffre d'affaires généré pour la plateforme, total des commissions dues et déjà versées
- Configuration globale du programme : taux de commission, mode premier paiement/récurrent, barème par palier, durée de vie du tracking, seuil minimum de retrait, mode de validation des inscriptions
- Validation, suspension ou rejet d'un affilié en cas de fraude suspectée (auto-parrainage, boutiques fictives, inscriptions massives suspectes depuis un même appareil/IP)
- Traitement des demandes de retrait : validation, marquage comme versé avec référence de paiement, ou rejet motivé
- Rapports exportables (PDF/Excel) : coût total du programme d'affiliation par période, boutiques apportées par affilié, top affiliés

## 7. Parcours utilisateurs (user flows) — synthèse

Les agents doivent produire des diagrammes de flux détaillés (type flowchart) pour chacun des parcours suivants avant développement :

1. Inscription exploitant → activation abonnement → configuration boutique
2. Inscription employé → validation → premier accès
3. Prise de commande → préparation → livraison → paiement → facture
4. Badgeage présence avec contrainte de géolocalisation
5. Alerte stock → bon de commande → validation → réception marchandise → mise à jour stock
6. Préparation et validation de la paie mensuelle
7. Inventaire physique → calcul des écarts → rapport
8. Renouvellement/expiration d'abonnement → période de grâce → suspension
9. Inscription affilié → validation → partage du lien → boutique parrainée → activation abonnement → commission créditée → demande de retrait

## 8. Gestion des abonnements, facturation et Dashboard Super-Admin plateforme

### 8.1 Abonnements et facturation

- 4 formules × 3 coefficients d'activité = 12 tarifs possibles (voir tableau section 6.2)
- Paiement récurrent automatisable (avec consentement) ou paiement manuel à chaque échéance
- Facture d'abonnement générée et envoyée par email à chaque paiement

### 8.2 Dashboard Super-Admin plateforme (équipe DebitManager)

C'est le **poste de pilotage global de toute la plateforme**, distinct des dashboards des exploitants. Il est accessible uniquement à l'équipe DebitManager (rôles internes dédiés, non rattachés à une boutique), avec sa propre authentification renforcée (2FA obligatoire, IP autorisées configurables). Il donne la main sur l'intégralité du système et une visibilité totale sur l'activité de toutes les boutiques clientes.

**8.2.1 Vue d'ensemble des boutiques (tenants)**

- Liste exhaustive de toutes les boutiques inscrites, avec pour chacune : nom commercial, type d'activité, pays, date d'inscription, formule d'abonnement souscrite, statut (essai/actif/en grâce/suspendu/expiré/résilié), date d'expiration, nombre d'employés actifs, dernière activité enregistrée
- Recherche et filtres avancés (pays, type d'activité, formule, statut, chiffre d'affaires, ancienneté)
- Fiche détaillée par boutique (drill-down complet) : historique intégral des paiements d'abonnement, historique des transactions clients, KPI de performance de la boutique, employés rattachés, tickets de support liés
- Actions administratives directes sur une boutique : suspendre/réactiver un compte, forcer le renouvellement, accorder un geste commercial (remise, extension de période d'essai), contacter directement le propriétaire, consulter (avec traçabilité) les données pour support technique

**8.2.2 Vue globale des transactions**

- Vue consolidée de **toutes les transactions de la plateforme, tous tenants confondus** : ventes clients (espèces/carte/mobile money) et paiements d'abonnement
- Filtres par période, boutique, pays, agrégateur de paiement (Kkiapay/Moneroo/Cinetpay), mode de paiement, statut (réussie/échouée/en attente/remboursée)
- Détail de chaque transaction : montant brut, commission plateforme prélevée (1%), montant net reversé à la boutique, référence agrégateur
- Suivi des webhooks et anomalies de réconciliation (transactions non réconciliées entre l'interne et les agrégateurs)
- Gestion centralisée des remboursements et litiges de paiement

**8.2.3 Tableau de bord des revenus plateforme**

- Revenus abonnements : total et détail par formule, par coefficient d'activité, par pays, par période (jour/semaine/mois/année), évolution dans le temps
- Revenus de commission (1%) : total et détail par période, par pays, par boutique, tendance
- Indicateurs SaaS : MRR (revenu mensuel récurrent), ARR (revenu annuel récurrent), taux de renouvellement, taux de résiliation (churn), nombre de nouvelles boutiques par période, valeur moyenne par client
- Prévisionnel de revenus basé sur les abonnements actifs et leur date d'échéance
- Suivi du coût du programme d'affiliation (commissions dues/versées par période) déduit du revenu net de la plateforme, avec vue par affilié
- Export de tous les rapports financiers (PDF/Excel/CSV) pour la comptabilité de l'équipe DebitManager

**8.2.4 Configuration et administration globale**

- Configuration globale des tarifs, formules et coefficients (avec historique des changements de grille tarifaire)
- Gestion complète du **programme d'affiliation** : taux et mode de commission, validation des affiliés, traitement des retraits (voir section 6.12)
- Gestion des intégrations de paiement (statut de connexion de chaque agrégateur, taux de succès des transactions par agrégateur, clés API)
- Gestion des comptes internes de l'équipe DebitManager (rôles et permissions du personnel support/technique/commercial, distincts des rôles des boutiques clientes)
- Centre de support/tickets : suivi des demandes des exploitants, historique des échanges, escalade

**8.2.5 Supervision et sécurité globale**

- Journal d'audit plateforme consolidé : toutes les actions sensibles réalisées par les Super-Admins et par les administrateurs de chaque boutique, consultable et exportable
- Alertes automatiques : boutiques proches d'expiration, échecs de paiement répétés, anomalies de réconciliation, tentatives de connexion suspectes, pics d'erreurs applicatives
- Vue de supervision technique : disponibilité du système, temps de réponse, taux d'erreur, état des synchronisations hors-ligne en attente

## 9. Paiements

### 9.1 Paiements clients

- Intégration native des SDK/API **Kkiapay, Moneroo, Cinetpay**
- Gestion des webhooks de confirmation avec système de nouvelle tentative (retry) en cas d'échec
- Réconciliation automatique quotidienne entre transactions internes et relevés des agrégateurs
- Aucune donnée de carte bancaire stockée sur les serveurs DebitManager (conformité PCI-DSS via redirection vers pages sécurisées des agrégateurs)

### 9.2 Paiement des salaires

- Paiement direct mobile money depuis le module paie, avec confirmation de réception

### 9.3 Trésorerie

- Historique complet et exportable de tous les mouvements de fonds
- Rapprochement automatique entre ventes enregistrées et fonds réellement reçus des agrégateurs

### 9.4 Paiement des commissions d'affiliation

- Versement des gains d'affiliation vers mobile money/virement, sur demande de retrait (seuil minimum atteint) ou selon une échéance régulière configurée par le Super-Admin
- Historique complet et exportable de tous les versements d'affiliation, avec justificatif téléchargeable pour l'affilié

## 10. Notifications et communication

Canaux à supporter, avec fallback en cascade :

1. Notification push in-app (prioritaire)
2. SMS (fallback automatique si push échoue ou pour utilisateurs sans smartphone récent)
3. Email (factures, bulletins de paie, rapports)

Événements déclencheurs (liste non exhaustive) : commande prête, paiement reçu, stock en alerte, retard badgeage, paie disponible, message d'équipe, expiration abonnement proche, tentative d'inscription employé, nouvelle boutique parrainée inscrite via un lien affilié, commission d'affiliation validée, retrait affilié traité.

## 11. Internationalisation

- Détection automatique du pays via géolocalisation/IP à la première ouverture
- Détection automatique de la langue selon les paramètres du téléphone (avec sélection manuelle possible parmi les langues supportées : français, anglais, et langues locales à définir selon marché prioritaire)
- Détection automatique de la devise selon le pays (XOF par défaut, extensible à d'autres devises pour expansion régionale)
- Tous les textes de l'application externalisés dans des fichiers de traduction (i18n), aucun texte en dur dans le code

## 12. Sécurité et conformité

### 12.1 Authentification et gestion des sessions

- Mots de passe hashés (bcrypt/argon2), jamais stockés ou journalisés en clair
- Politique de mot de passe forte (longueur minimale, complexité) et blocage temporaire du compte après un nombre défini de tentatives échouées
- **Authentification à deux facteurs (2FA)** obligatoire pour les rôles Administrateur/Comptable/Promoteur et pour tous les comptes de l'équipe DebitManager (Super-Admin)
- Sessions gérées par tokens à durée de vie courte + mécanisme de rafraîchissement, révocation immédiate possible (déconnexion à distance d'un appareil compromis, ex. perte de téléphone)
- Détection de tentative de connexion suspecte (changement d'appareil, localisation incohérente, multiplication d'échecs) avec alerte à l'utilisateur et/ou blocage temporaire

### 12.2 Protection applicative

- Protection contre les vulnérabilités standards (OWASP Top 10) : injection SQL (requêtes paramétrées/ORM), XSS, CSRF, validation systématique de toutes les entrées côté serveur
- En-têtes de sécurité HTTP (HSTS, CSP, X-Frame-Options) et HTTPS strictement obligatoire sur tous les échanges
- Limitation de débit (rate limiting) sur les endpoints sensibles (connexion, paiement, API publique) pour prévenir les attaques par force brute et le credential stuffing
- Protection anti-DDoS et pare-feu applicatif (WAF) au niveau de l'infrastructure
- Certificate pinning et détection root/jailbreak sur les applications mobiles pour limiter les risques de compromission côté client

### 12.3 Protection des données

- Chiffrement des données sensibles au repos et en transit (TLS 1.2+ a minima)
- Isolation stricte des données entre entreprises clientes (architecture multi-tenant, `tenant_id` vérifié systématiquement à chaque requête)
- Gestion sécurisée des secrets (clés API des agrégateurs, identifiants tiers) via un coffre-fort de secrets (vault) ou variables d'environnement chiffrées — jamais en dur dans le code source
- Rotation périodique des clés et secrets sensibles
- Séparation stricte des environnements (développement/test/production), aucune donnée réelle de production utilisée en environnement de test

### 12.4 Journalisation, audit et supervision

- Journal d'audit (audit log) horodaté et non modifiable pour toute action sensible (modification de prix, validation de paie, suppression de compte, retrait de fonds, action Super-Admin), consultable et exportable
- Supervision applicative continue avec alerting automatique en cas d'anomalie (pic d'erreurs, tentatives d'intrusion, échecs de synchronisation)
- Détection de fraude sur les paiements : limites de montants configurables, détection de schémas de transactions suspectes, blocage temporaire avec revue manuelle

### 12.5 Sauvegarde, continuité et tests

- Sauvegardes automatiques quotidiennes chiffrées, avec tests de restauration périodiques documentés
- Plan de reprise après sinistre documenté (voir section 15)
- Tests d'intrusion (pentest) réalisés avant la mise en production initiale et à chaque évolution majeure
- Scan continu des vulnérabilités des dépendances logicielles (SCA) intégré au pipeline de déploiement (CI/CD)

### 12.6 Conformité et droits des utilisateurs

- Politique de confidentialité et conditions d'utilisation conformes à la réglementation locale (protection des données personnelles, cadre OHADA/CEDEAO selon pays)
- Aucune donnée de carte bancaire stockée sur les serveurs DebitManager (conformité PCI-DSS déléguée aux agrégateurs de paiement)
- Droits des utilisateurs sur leurs données personnelles : export des données et suppression de compte sur demande, dans le respect des obligations légales de conservation (comptabilité, fiscalité)
- Procédure documentée de réponse aux incidents de sécurité, avec notification des utilisateurs concernés dans les délais réglementaires applicables
- Gestion fine des permissions par rôle (voir section 16)

## 13. Mode hors-ligne et synchronisation

Exigence critique compte tenu du contexte de connectivité en Afrique de l'Ouest :

- Prise de commande, consultation des stocks et validation de paiement en espèces doivent fonctionner **sans connexion internet**
- File d'attente locale des actions effectuées hors-ligne, synchronisée automatiquement dès reconnexion
- Résolution de conflits : horodatage serveur faisant foi pour tout ce qui touche à la trésorerie ; alerte à l'utilisateur en cas de conflit non résolu automatiquement
- Indicateur visuel clair de l'état de connexion (en ligne / hors-ligne / synchronisation en cours)
- Les fonctionnalités nécessitant impérativement une connexion (paiement carte/mobile money, validation de compte) doivent afficher un message clair d'indisponibilité hors-ligne

## 14. Design système (UI/UX)

### 14.1 Principes directeurs

- Interface pensée pour des utilisateurs **peu ou pas lettrés** : usage prioritaire d'icônes explicites, de couleurs sémantiques (vert = validé, orange = attention, rouge = alerte/erreur), de confirmations sonores/vibratoires, minimum de texte
- Navigation par gros boutons tactiles, peu de niveaux de menu
- Mode sombre et mode clair
- Accessibilité : contraste élevé, tailles de police ajustables

### 14.2 Livrables design

- Logo (SVG, PNG multi-résolutions, versions couleur/monochrome/fond transparent)
- Charte graphique complète : palette de couleurs, typographies, iconographie, composants UI (boutons, cartes, formulaires, tableaux de bord)
- Maquettes haute-fidélité de tous les écrans clés (Figma ou équivalent)
- Design system componentisé et réutilisable (pour cohérence mobile/web)

## 15. Exigences non-fonctionnelles

- **Performance** : temps de réponse < 1s pour les actions courantes (prise de commande, consultation stock)
- **Scalabilité** : architecture capable de supporter la montée en charge (multiplication du nombre d'entreprises clientes) sans refonte majeure
- **Disponibilité** : objectif de disponibilité 99,5%, plan de reprise après sinistre documenté
- **Tests** : couverture de tests automatisés (unitaires + intégration) sur les modules critiques (paiement, présence, stock, paie) ; tests de charge avant mise en production
- **Monitoring** : supervision applicative et alerting en cas d'incident (temps de réponse anormal, taux d'erreur, échec de synchronisation)
- **Support** : centre d'aide intégré (FAQ), chat support, tutoriel d'onboarding interactif adapté aux utilisateurs peu lettrés

## 16. Rôles et matrice de permissions

Chaque droit fonctionnel du logiciel doit être représenté comme une permission activable/désactivable indépendamment, organisée par module (Commandes, Stocks, Personnel, Paie, Trésorerie, Comptabilité, Rapports, Configuration). Les agents doivent produire une matrice complète croisant les 11 profils prédéfinis avec l'ensemble des permissions du système, avec des préréglages par défaut cohérents pour chaque profil (modifiables ensuite par l'administrateur). — **Matrice de référence figée dans `permissions-matrix.md`.**

## 17. KPIs et tableaux de bord

Voir section 6.11 pour le détail par profil. Les agents doivent implémenter un moteur de KPI configurable permettant l'ajout futur de nouveaux indicateurs sans refonte du système de reporting.

## 18. Plan de développement par phases

**Phase 0 — Cadrage technique**
- Choix définitif de la stack, schéma de base de données détaillé, maquettes UI validées

**Phase 1 — Socle (MVP)**
- Inscription/authentification (exploitant + employé), gestion abonnement + paiement, configuration boutique, gestion produits/stocks de base, prise de commande simple, paiement espèces

**Phase 2 — Opérations avancées**
- Paiement carte/mobile money (agrégateurs), badgeage/présence avec géolocalisation, gestion des tables, workflow cuisine/bar (KDS), mode hors-ligne

**Phase 3 — Gestion & finance**
- Paie complète, trésorerie, comptabilité, approvisionnements/fournisseurs, inventaire physique et écarts

**Phase 4 — Pilotage & communication**
- KPI et dashboards complets, messagerie interne, notifications multi-canal, primes automatiques

**Phase 5 — Finitions & lancement**
- QR code commande client, multi-boutiques/franchise, internationalisation complète, tests de charge, audit de sécurité, préparation au lancement

## 19. Critères d'acceptation (Definition of Done)

Une fonctionnalité est considérée terminée uniquement si :

- Elle fonctionne en ligne **et** hors-ligne (quand applicable)
- Elle est traduite (i18n) et s'affiche correctement dans toutes les langues supportées
- Elle respecte la matrice de permissions (invisible si non autorisée)
- Elle est couverte par des tests automatisés
- Elle est responsive mobile/tablette/web
- Elle génère les entrées correspondantes dans le journal d'audit si l'action est sensible
- Elle a été validée sur un appareil bas de gamme avec connexion 2G/3G simulée

## 20. Livrables attendus

1. Application mobile (Android + iOS)
2. Dashboard web responsive (administration, comptabilité)
3. Backend API documenté (documentation technique type OpenAPI/Swagger)
4. Base de données avec schéma documenté
5. Charte graphique et logo complets
6. Documentation utilisateur (guides + tutoriels vidéo/onboarding in-app)
7. Documentation technique de déploiement et de maintenance
8. Suite de tests automatisés
9. Environnement de démonstration fonctionnel

## 21. Annexes

### 21.1 Glossaire

- **XOF** : Franc CFA (Afrique de l'Ouest)
- **KDS** : Kitchen Display System (écran d'affichage des commandes cuisine)
- **KPI** : Key Performance Indicator (indicateur de performance)
- **Tenant** : entreprise cliente isolée dans l'architecture multi-tenant
- **Webhook** : notification automatique envoyée par un agrégateur de paiement pour confirmer une transaction
- **Affilié** : personne externe faisant la promotion de DebitManager via un lien/code de parrainage unique, rémunérée en commission sur les abonnements des boutiques qu'elle apporte

### 21.2 Rappel des tarifs

| Formule | Buvette | Bar-restaurant (x1,5) | Boîte de nuit/Lounge (x2) |
|---|---|---|---|
| Base (mensuel) | 50 000 XOF | 75 000 XOF | 100 000 XOF |
| Moyenne (3 mois) | 130 000 XOF | 195 000 XOF | 260 000 XOF |
| Semestrielle (6 mois) | 240 000 XOF | 360 000 XOF | 480 000 XOF |
| Suprême (annuel) | 400 000 XOF | 600 000 XOF | 800 000 XOF |

### 21.3 Catégories/types/unités préconfigurés

- **Catégories** : bières, sucreries, énergisantes, spiritueux, repas
- **Types** : 33cl, 50cl, 60cl, 1 litre, champagnes, vins, whisky, autres spiritueux, petit-déjeuner, accompagnement, poissons, viande, résistance, jus de fruits naturels, dessert
- **Unités** : bouteilles, plats, conso, dose, tasse, unité

---

*Ce document doit être considéré comme la source de vérité fonctionnelle du projet ; toute ambiguïté rencontrée en cours de développement doit être résolue en cohérence avec les principes directeurs énoncés en section 2 et 14.1.*
