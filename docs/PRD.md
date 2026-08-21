# PRD — DebitManager (Bar Maquis Master)

**Projet :** DebitManager (Bar Maquis Master) — Plateforme SaaS mobile & web de gestion de bars, maquis, restaurants, boîtes de nuit et lounges
**Version :** 1.0 — Statut : Prêt pour développement
**Document de référence associé :** Cahier des charges complet (spécifications techniques exhaustives)

---

## 1. Résumé exécutif

DebitManager (nom commercial : Bar Maquis Master) est une plateforme SaaS mobile-first (Android/iOS) et web, par abonnement, destinée aux exploitants de bars, maquis, restaurants, boîtes de nuit et lounges en Afrique de l'Ouest. Elle digitalise l'intégralité de la gestion d'un établissement — stocks, ventes, personnel, présences, paie, approvisionnements, trésorerie, comptabilité — avec un pilotage par indicateurs en temps réel.

Le produit génère des revenus via deux leviers : l'abonnement récurrent des boutiques (4 formules × 3 coefficients d'activité) et une commission de 1% sur les transactions clients réglées par carte/mobile money. Un **programme d'affiliation** ouvert au public permet à toute personne de promouvoir la plateforme et de percevoir une commission sur les abonnements des boutiques qu'elle apporte, et un **dashboard Super-Admin** donne à l'équipe DebitManager le contrôle et la visibilité totale sur l'ensemble de la plateforme (boutiques, transactions, revenus, affiliés).

Contexte de conception : connectivité instable et utilisateurs finaux parfois peu ou pas lettrés → simplicité extrême, usage massif d'icônes/couleurs, fonctionnement hors-ligne robuste.

## 2. Problème et opportunité

**Problèmes constatés chez les exploitants cibles :**
- Gestion manuelle ou fragmentée des stocks, ventes et caisses → pertes, erreurs, fraude difficiles à détecter
- Absence de visibilité temps réel sur la trésorerie et la performance du personnel
- Gestion de la paie, des présences et des réapprovisionnements chronophage et peu fiable
- Peu ou pas d'outils adaptés à un contexte de connectivité instable et à des équipes peu formées au digital

**Opportunité :**
- Marché large et peu digitalisé (bars, maquis, restaurants, boîtes de nuit, lounges) en forte croissance en Afrique de l'Ouest
- Modèle économique récurrent (abonnement) et transactionnel (commission), renforcé par une croissance organique via un réseau d'affiliés externes sans coût d'acquisition fixe

## 3. Vision produit et objectifs

**Vision :** devenir l'outil de gestion de référence pour tout établissement de restauration/débit de boissons en Afrique de l'Ouest, aussi simple à utiliser qu'une application grand public.

**Objectifs produit :**
- Digitaliser l'ensemble des opérations d'un établissement sur une seule plateforme
- Réduire les pertes (stocks, fraude, erreurs de caisse)
- Fournir une visibilité temps réel sur les ventes, la trésorerie et la performance du personnel
- Automatiser la paie, les présences et les réapprovisionnements
- Fluidifier le paiement client (espèces, carte, mobile money)
- Générer des revenus récurrents (abonnement + commission) et accélérer l'acquisition via l'affiliation

## 4. Périmètre du produit

**Inclus (in scope) :**
- Application mobile (Android/iOS) pour exploitants, employés et rôles opérationnels
- Dashboard web responsive pour l'administration, la comptabilité et le pilotage
- Gestion complète : abonnements, produits/stocks, commandes, tables, présences, paie, trésorerie, comptabilité, communication interne, KPI
- Paiement client multi-mode (espèces, carte, mobile money) via Kkiapay, Moneroo, Cinetpay
- Mode hors-ligne pour les opérations critiques
- Programme d'affiliation public et son back-office
- Dashboard Super-Admin plateforme

**Exclus (hors périmètre v1) :**
- Marketplace ou livraison tierce (livraison à domicile via prestataires externes)
- Gestion multi-devises simultanée pour une même boutique (une devise par boutique à l'ouverture, extensible plus tard)
- Application dédiée pour le client final au-delà du menu QR (pas d'app client à télécharger en v1)
- Comptabilité fiscale automatisée multi-pays au-delà d'OHADA/CEDEAO

## 5. Utilisateurs cibles et personas

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
| Super-Admin (équipe DebitManager) | Éditeur de la plateforme | Vue globale sur toutes les boutiques, transactions, revenus, supervision totale |
| Affilié (partenaire promotionnel) | Toute personne promouvant DebitManager | Lien de parrainage, suivi des gains, retrait des commissions |

## 6. Modèle économique (pricing & revenus)

**Revenu 1 — Abonnement récurrent des boutiques** (montants mensuels équivalents en XOF) :

| Formule | Buvette (x1) | Bar-restaurant (x1,5) | Boîte de nuit/Lounge (x2) |
|---|---|---|---|
| Base (mensuel) | 50 000 XOF | 75 000 XOF | 100 000 XOF |
| Moyenne (3 mois) | 130 000 XOF | 195 000 XOF | 260 000 XOF |
| Semestrielle (6 mois) | 240 000 XOF | 360 000 XOF | 480 000 XOF |
| Suprême (annuel) | 400 000 XOF | 600 000 XOF | 800 000 XOF |

- Essai gratuit de 14 jours à la première inscription
- Grille tarifaire modifiable globalement depuis le Super-Admin

**Revenu 2 — Commission sur transactions clients :**
- 1% prélevé automatiquement sur chaque transaction carte/mobile money réglée par un client final

**Coût — Programme d'affiliation :**
- Commission versée aux affiliés sur les abonnements des boutiques qu'ils apportent, taux et mode (premier paiement/récurrent) configurables ; ce coût est suivi et déduit du revenu net dans le dashboard Super-Admin

## 7. Exigences fonctionnelles par module

### 7.1 Inscription et gestion de compte
Inscription (téléphone/email/OTP/réseaux sociaux) → choix exploitant ou employé → pour l'exploitant : configuration boutique → choix abonnement → paiement → déblocage du dashboard. Essai gratuit 14 jours. Cycle de vie abonnement : rappels avant expiration, période de grâce de 3 jours, changement de formule au prorata.

### 7.2 Types d'activité et tarification
Trois types d'activité (buvette, bar-restaurant, boîte de nuit/lounge) avec coefficients tarifaires et catégories de produits associées. Catégories/types/unités préconfigurés mais extensibles par boutique.

### 7.3 Produits, stocks et approvisionnements
Gestion produit complète (catégorie/type/unité/prix/image), seuils d'alerte et de sécurité, génération de bons de commande avec workflow de validation, fiches fournisseurs, inventaire physique périodique avec calcul automatique des écarts, gestion des pertes/casse/péremption.

### 7.4 Tables et espaces de travail
Plan de salle configurable, statut temps réel des tables, réservation, transfert/fusion/scission de tables, commande autonome par QR code (menu digital client).

### 7.5 Processus de commande et paiement
Prise de commande hors-ligne → ventilation automatique par section (bar/cuisine) → attribution → notification de disponibilité → livraison → facturation (espèces/mobile money/carte) → split billing, pourboires, workflow d'annulation/remboursement tracé.

### 7.6 Présences (badgeage)
Plannings par employé, badgeage automatique à la connexion avec contrainte de géolocalisation, gestion des retards/absences/exceptions, congés et demandes d'absence.

### 7.7 Personnel et rôles
11 profils prédéfinis + profils personnalisés, permissions activables/désactivables par droit, dashboard généré dynamiquement selon les droits, fiche employé complète (documents, coordonnées de paiement, historique).

### 7.8 Trésorerie et comptabilité
Vue consolidée des fonds par mode de paiement, retrait vers mobile money, commission plateforme transparente, comptabilité complète (dépenses, rapprochement bancaire, exports), conformité fiscale locale (TVA, numérotation légale des factures).

### 7.9 Paie
Préparation mensuelle par le comptable, validation par le promoteur, paiement mobile money/virement, système de primes basé sur la performance, historique et bulletins PDF.

### 7.10 Communication interne
Messagerie individuelle/groupe depuis l'administration, notifications push + fallback SMS.

### 7.11 KPI et tableaux de bord (par profil)
Chiffre d'affaires, ventes par catégorie, occupation des tables, performance employé, écarts d'inventaire, trésorerie, absentéisme, comparatif multi-boutiques ; vues dédiées par rôle (serveur, comptable, magasinier). Exports PDF/Excel.

## 8. Programme d'affiliation

**Objectif produit :** transformer toute personne intéressée en apporteur d'affaires, sans dépendre uniquement de l'acquisition payante, en la rémunérant sur les abonnements des boutiques qu'elle apporte.

**Fonctionnement clé :**
- Inscription publique libre, génération automatique d'un code + lien de parrainage unique
- Attribution permanente de la boutique parrainée au premier lien cliqué/code saisi, avec tracking horodaté
- Commission calculée en pourcentage configurable sur les paiements d'abonnement (distincte de la commission de 1% sur les transactions clients), en mode premier paiement ou récurrent tant que la boutique reste active, avec barème par palier optionnel
- Dashboard affilié : boutiques parrainées, gains détaillés, outils de partage (lien, QR code), demande de retrait (seuil configurable)
- Anti-fraude : détection d'auto-parrainage, de boutiques fictives, d'inscriptions suspectes ; validation manuelle ou automatique des affiliés configurable

**Gestion Super-Admin du programme :** configuration globale des taux/modes, validation/suspension des affiliés, traitement des demandes de retrait, rapports de coût et de ROI du programme.

## 9. Dashboard Super-Admin plateforme

Poste de pilotage global réservé à l'équipe DebitManager, avec authentification renforcée (2FA obligatoire).

- **Boutiques (tenants)** : liste et fiche détaillée de chaque boutique (statut, abonnement, CA généré, employés, dernière activité), actions de suspension/réactivation/geste commercial
- **Transactions** : vue consolidée de toutes les transactions plateforme (ventes + abonnements), filtrable, avec détail commission/montant net, gestion des remboursements et litiges
- **Revenus** : revenus abonnements et commissions par période/pays/formule, MRR/ARR, churn, taux de renouvellement, prévisionnel, coût du programme d'affiliation déduit du revenu net
- **Configuration globale** : tarifs/formules/coefficients, intégrations de paiement, programme d'affiliation, comptes internes équipe DebitManager, contenu global (CGU, FAQ)
- **Supervision** : journal d'audit consolidé, alertes automatiques (expirations, échecs de paiement, anomalies), supervision technique (disponibilité, erreurs, synchronisations en attente)

## 10. Exigences non-fonctionnelles

- **Performance** : temps de réponse < 1s pour les actions courantes
- **Scalabilité** : montée en charge du nombre de boutiques sans refonte majeure
- **Disponibilité** : objectif 99,5%, plan de reprise après sinistre documenté
- **Tests** : couverture automatisée sur les modules critiques (paiement, présence, stock, paie), tests de charge avant mise en production
- **Monitoring** : supervision applicative et alerting
- **Support** : centre d'aide intégré, chat support, onboarding adapté aux utilisateurs peu lettrés
- **Hors-ligne** : prise de commande, consultation stock et paiement espèces fonctionnels sans connexion, synchronisation différée avec résolution de conflits (horodatage serveur faisant foi pour la trésorerie)

## 11. Architecture technique (résumé)

- **Mobile :** Flutter (base de code unique iOS/Android, offline-first)
- **Web (dashboards) :** React + TypeScript
- **Backend :** Node.js (NestJS), API REST + WebSocket
- **Données :** PostgreSQL + Redis, architecture multi-tenant (isolation stricte par `tenant_id`)
- **Stockage fichiers :** service S3-compatible
- **Notifications :** push cross-plateforme (FCM/APNs) + fallback SMS
- **Hébergement :** cloud multi-zone, sauvegardes quotidiennes chiffrées, rétention 90 jours minimum
- **Intégrations :** Kkiapay, Moneroo, Cinetpay (webhooks + réconciliation automatique), géolocalisation, email transactionnel, SMS

## 12. Sécurité et conformité

- Authentification 2FA obligatoire pour les rôles sensibles et le Super-Admin, sessions à durée courte et révocables à distance
- Protection applicative standard (OWASP Top 10), rate limiting, WAF/anti-DDoS, certificate pinning mobile
- Chiffrement des données au repos et en transit, secrets en vault, séparation stricte des environnements
- Journal d'audit horodaté et non modifiable pour toute action sensible, supervision continue et détection de fraude sur les paiements
- Sauvegardes chiffrées quotidiennes, pentest avant mise en production, scan continu des dépendances (SCA)
- Conformité : politique de confidentialité locale, aucune donnée de carte stockée (PCI-DSS délégué aux agrégateurs), droits d'export/suppression des données utilisateurs, procédure de réponse aux incidents

## 13. Expérience utilisateur et design

- Conçu pour des utilisateurs peu ou pas lettrés : icônes explicites, couleurs sémantiques, confirmations sonores/vibratoires, minimum de texte
- Navigation par gros boutons tactiles, peu de niveaux de menu, mode sombre/clair, accessibilité (contraste, taille de police)
- Livrables design : logo et charte graphique complets, maquettes haute-fidélité, design system componentisé mobile/web

## 14. Internationalisation

- Détection automatique du pays, de la langue et de la devise (XOF par défaut), sélection manuelle possible
- Tous les textes externalisés (i18n), langues supportées : français, anglais, langues locales selon marché prioritaire

## 15. Métriques de succès (North Star & KPIs produit)

**North Star Metric :** nombre de boutiques actives (abonnement payant en cours) sur la plateforme.

**Métriques d'acquisition et de croissance :**
- Nombre de nouvelles boutiques inscrites / période, taux de conversion essai → abonnement payant
- Nombre d'affiliés actifs, nombre de boutiques apportées par affiliation, part des nouvelles boutiques issues du programme d'affiliation

**Métriques de rétention et revenu :**
- MRR/ARR, taux de renouvellement, taux de churn, valeur moyenne par boutique (par formule/coefficient)
- Volume et revenu de commission sur transactions clients (1%)

**Métriques d'usage produit :**
- Taux d'adoption des modules clés (présences, paie, inventaire) par boutique active
- Fréquence d'utilisation du mode hors-ligne et taux de succès de synchronisation
- Taux de résolution des tickets support, NPS/satisfaction exploitants

## 16. Roadmap et priorisation (MVP → V1 → V2)

- **Phase 0 — Cadrage technique** : choix définitif de la stack, schéma de données détaillé, maquettes UI validées
- **Phase 1 — MVP** : inscription/authentification, abonnement + paiement, configuration boutique, produits/stocks de base, prise de commande simple, paiement espèces
- **Phase 2 — Opérations avancées** : paiement carte/mobile money, badgeage/présence géolocalisé, gestion des tables, workflow cuisine/bar (KDS), mode hors-ligne
- **Phase 3 — Gestion & finance** : paie complète, trésorerie, comptabilité, approvisionnements/fournisseurs, inventaire physique
- **Phase 4 — Pilotage, communication & croissance** : KPI et dashboards complets, messagerie interne, notifications multi-canal, primes automatiques, **lancement du programme d'affiliation** et du **dashboard Super-Admin complet**
- **Phase 5 — Finitions & lancement** : QR code commande client, multi-boutiques/franchise, internationalisation complète, tests de charge, audit de sécurité, préparation au lancement

## 17. Risques, hypothèses et dépendances

**Risques :**
- Connectivité instable en zone d'usage → risque d'adoption si le mode hors-ligne n'est pas fiable à 100% sur les fonctions critiques
- Fraude sur le programme d'affiliation (auto-parrainage, faux comptes) pouvant éroder la marge si les contrôles anti-fraude sont insuffisants
- Dépendance aux agrégateurs de paiement tiers (Kkiapay, Moneroo, Cinetpay) pour la disponibilité des paiements
- Faible littératie numérique de certains utilisateurs finaux → risque d'adoption si l'UX n'est pas suffisamment simplifiée

**Hypothèses :**
- Les exploitants sont prêts à payer un abonnement récurrent pour une solution qui réduit les pertes et automatise la gestion
- Un programme d'affiliation bien rémunéré peut générer une acquisition organique significative

**Dépendances externes :**
- Disponibilité et fiabilité des API des agrégateurs de paiement
- Services tiers : FCM/APNs (push), SMS gateway, service d'email transactionnel

## 18. Critères d'acceptation (Definition of Done)

Une fonctionnalité est considérée terminée uniquement si :
- Elle fonctionne en ligne **et** hors-ligne (quand applicable)
- Elle est traduite (i18n) et s'affiche correctement dans toutes les langues supportées
- Elle respecte la matrice de permissions (invisible si non autorisée)
- Elle est couverte par des tests automatisés
- Elle est responsive mobile/tablette/web
- Elle génère les entrées correspondantes dans le journal d'audit si l'action est sensible
- Elle a été validée sur un appareil bas de gamme avec connexion 2G/3G simulée

## 19. Livrables attendus

1. Application mobile (Android + iOS)
2. Dashboard web responsive (boutique + Super-Admin)
3. Backend API documenté (OpenAPI/Swagger)
4. Base de données avec schéma documenté
5. Charte graphique et logo complets
6. Documentation utilisateur (guides + tutoriels/onboarding in-app)
7. Documentation technique de déploiement et de maintenance
8. Suite de tests automatisés
9. Environnement de démonstration fonctionnel

## 20. Annexes

### 20.1 Glossaire
- **XOF** : Franc CFA (Afrique de l'Ouest)
- **KDS** : Kitchen Display System
- **KPI** : Key Performance Indicator
- **Tenant** : entreprise cliente isolée dans l'architecture multi-tenant
- **MRR/ARR** : revenu mensuel/annuel récurrent
- **Affilié** : personne externe faisant la promotion de DebitManager via un lien/code de parrainage, rémunérée en commission sur les abonnements des boutiques apportées

### 20.2 Document technique associé
Le **cahier des charges technique complet** (spécifications exhaustives par module, modèle de données détaillé, parcours utilisateurs, matrice de permissions) fait foi pour toute question d'implémentation non couverte par ce PRD.
