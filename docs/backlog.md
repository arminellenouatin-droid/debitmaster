# Backlog détaillé — Sprint par sprint — DebitManager

**Objectif du document :** décomposer le plan de développement par phases (cahier des charges, section 18) en sprints de 2 semaines, avec user stories et critères d'acceptation par ticket, pour un pilotage agile actionnable par les agents de développement.

**Format de chaque ticket :**

> En tant que [persona], je veux [action], afin de [bénéfice].
> **Critères d'acceptation :** liste de conditions vérifiables.

**Rappel — Definition of Done globale (s'applique à chaque ticket en plus de ses critères propres) :**
- fonctionne en ligne et hors-ligne quand applicable
- traduit (i18n)
- respecte la matrice de permissions
- couvert par des tests automatisés
- responsive mobile/tablette/web
- génère une entrée d'audit si action sensible
- validé sur appareil bas de gamme en 2G/3G simulée

---

## PHASE 0 — CADRAGE TECHNIQUE (SPRINT 0)

**Objectif de sprint :** verrouiller les fondations techniques avant tout développement fonctionnel.

**T0.1** En tant qu'équipe technique, je veux valider la stack définitive (Flutter, React/TypeScript, NestJS, PostgreSQL/Redis), afin d'éviter tout changement d'architecture en cours de projet.
Critères : document d'architecture validé · POC de connexion offline-first Flutter/SQLite chiffré fonctionnel · pipeline CI/CD initialisé.

**T0.2** En tant qu'équipe technique, je veux le schéma de base de données complet implémenté en migrations, afin que tous les agents partent du même schéma.
Critères : toutes les tables de modele-donnees.md créées via migrations versionnées · contraintes FK et index tenant_id en place.

**T0.3** En tant qu'équipe design, je veux les maquettes haute-fidélité des écrans clés validées, afin de cadrer le développement frontend.
Critères : maquettes Figma couvrant onboarding, prise de commande, dashboard exploitant · design system (design-system.md) exporté en tokens consommables.

**T0.4** En tant qu'équipe technique, je veux l'environnement de démonstration (dev/staging) opérationnel, afin de permettre les démos de sprint.
Critères : environnements dev/staging/prod séparés · déploiement automatisé sur staging à chaque merge.

## PHASE 1 — SOCLE (MVP)

### SPRINT 1 — Inscription, abonnement, configuration boutique

**T1.1** En tant qu'exploitant, je veux m'inscrire avec mon téléphone vérifié par OTP, afin de créer mon compte en toute sécurité.
Critères : OTP envoyé et vérifié · mot de passe hashé (bcrypt/argon2) · connexion sociale (Google/Facebook/Apple) fonctionnelle.

**T1.2** En tant qu'exploitant, je veux créer ma boutique en choisissant son type d'activité, afin d'obtenir mon code société unique.
Critères : code société généré unique · les 3 types d'activité disponibles avec coefficient tarifaire correct.

**T1.3** En tant qu'exploitant, je veux choisir une formule d'abonnement et payer via Kkiapay/Moneroo/Cinetpay, afin d'activer mon compte.
Critères : les 12 tarifs (4 formules × 3 coefficients) affichés correctement · webhook de confirmation traité · statut ACTIVE déclenché uniquement après paiement confirmé.

**T1.4** En tant qu'exploitant à ma première inscription, je veux bénéficier de 14 jours d'essai gratuit sans carte obligatoire, afin de tester le produit sans engagement.
Critères : essai activable une seule fois par boutique · compte à rebours visible · aucune fonctionnalité bloquée pendant l'essai.

**T1.5** En tant qu'employé, je veux rejoindre une boutique avec le code société fourni par mon exploitant, afin d'obtenir mon accès.
Critères : message d'attente affiché · alerte temps réel à l'administrateur · validation manuelle ou création directe fonctionnelles (voir user-flows.md §2).

### SPRINT 2 — Produits, stocks de base, première commande

**T2.1** En tant qu'administrateur, je veux ajouter des produits avec catégorie/type/unité/prix, afin de configurer mon catalogue.
Critères : catégories/types/unités préconfigurés disponibles et extensibles · historique de prix enregistré à chaque modification.

**T2.2** En tant qu'administrateur, je veux définir un seuil d'alerte et un seuil de sécurité par produit, afin d'être notifié à temps.
Critères : notification déclenchée automatiquement au franchissement du seuil.

**T2.3** En tant que serveur, je veux prendre une commande simple sur mon téléphone, afin de la transmettre au bar/à la cuisine.
Critères : commande fonctionne hors-ligne · ventilation automatique par section correcte.

**T2.4** En tant que serveur, je veux encaisser un paiement en espèces, afin de clôturer la commande.
Critères : facture PDF générée avec numéro légal séquentiel · mouvement de trésorerie enregistré.

## PHASE 2 — OPÉRATIONS AVANCÉES

### SPRINT 3 — Paiements carte/mobile money, badgeage

**T3.1** En tant que client final, je veux payer par mobile money, afin de régler ma commande sans espèces.
Critères : demande de validation envoyée au téléphone du client · facture + notification envoyées après confirmation · commission plateforme de 1% calculée et enregistrée.

**T3.2** En tant que client final, je veux payer par carte bancaire via un lien sécurisé, afin de ne pas partager mes données de carte avec DebitManager.
Critères : aucune donnée de carte stockée côté DebitManager · redirection vers page agrégateur · réconciliation automatique quotidienne fonctionnelle.

**T3.3** En tant qu'employé, je veux badger automatiquement à ma connexion avec vérification de géolocalisation, afin que ma présence soit enregistrée fidèlement.
Critères : connexion refusée hors du rayon configuré sauf exception · statuts à l'heure/retard/absent corrects selon les règles de temporisation (10 min / 30 min).

**T3.4** En tant que superviseur, je veux accorder une exception de badgeage, afin de gérer les cas particuliers.
Critères : exception tracée avec motif et auteur dans Attendance.

### SPRINT 4 — Tables, workflow cuisine/bar, mode hors-ligne renforcé

**T4.1** En tant qu'administrateur, je veux configurer le plan de salle (zones, tables, capacité), afin d'organiser l'espace de vente.
Critères : statuts libre/occupée/réservée/à nettoyer mis à jour en temps réel (WebSocket).

**T4.2** En tant que chef cuisine, je veux recevoir les commandes de ma section et les attribuer à un cuisinier, afin d'organiser la préparation.
Critères : écran KDS filtré par section · bouton "commande prête" déclenche notification au serveur.

**T4.3** En tant que serveur, je veux que mes actions hors-ligne se synchronisent automatiquement à la reconnexion, afin de ne perdre aucune commande.
Critères : file d'attente locale fonctionnelle · résolution de conflits par horodatage serveur pour la trésorerie · indicateur de connexion visible en permanence.

## PHASE 3 — GESTION & FINANCE

### SPRINT 5 — Paie complète

**T5.1** En tant que comptable, je veux préparer la paie mensuelle par employé, afin de calculer les montants dus.
Critères : primes/retenues intégrées · suggestions automatiques de primes affichées (meilleur vendeur, assiduité, zéro écart).

**T5.2** En tant que promoteur, je veux valider la paie avant paiement, afin de garder le contrôle final.
Critères : paiement bloqué tant que non validé · action tracée dans AuditLog.

**T5.3** En tant qu'employé, je veux recevoir mon bulletin de salaire en PDF, afin de garder une preuve de paiement.
Critères : bulletin téléchargeable, historique consultable.

### SPRINT 6 — Trésorerie, comptabilité, approvisionnements, inventaire

**T6.1** En tant que comptable, je veux une vue consolidée de la trésorerie par mode de paiement, afin de piloter les flux financiers.
Critères : rapprochement automatique entre ventes et fonds reçus des agrégateurs.

**T6.2** En tant que chargé d'approvisionnement, je veux générer un bon de commande à partir d'une alerte de stock, afin de réapprovisionner à temps.
Critères : workflow validation → envoi fournisseur → réception → mise à jour stock fonctionnel de bout en bout (voir user-flows.md §5).

**T6.3** En tant que magasinier, je veux réaliser un inventaire physique périodique, afin de détecter les écarts.
Critères : calcul automatique des écarts théorique/réel · interprétation automatique (perte/vol probable/erreur de saisie) générée.

## PHASE 4 — PILOTAGE, COMMUNICATION & CROISSANCE

### SPRINT 7 — KPI, communication, primes automatiques

**T7.1** En tant qu'exploitant, je veux un tableau de bord KPI complet (CA, ventes par catégorie, trésorerie, absentéisme), afin de piloter ma boutique.
Critères : moteur de KPI configurable, permettant l'ajout futur d'indicateurs sans refonte.

**T7.2** En tant qu'administrateur, je veux envoyer un message à un groupe ou un individu, afin de communiquer avec mon équipe.
Critères : notification push + fallback SMS fonctionnels.

### SPRINT 8 — Programme d'affiliation

**T8.1** En tant que particulier, je veux m'inscrire comme affilié via un formulaire public, afin d'obtenir mon lien de parrainage.
Critères : code + lien uniques générés · validation automatique ou manuelle selon configuration.

**T8.2** En tant qu'affilié, je veux que la boutique inscrite via mon lien me soit attribuée définitivement, afin de percevoir mes commissions.
Critères : tracking horodaté, attribution au premier clic/code, durée de vie du tracking respectée (voir user-flows.md §9).

**T8.3** En tant qu'affilié, je veux consulter mes gains et demander un retrait, afin de percevoir mes commissions.
Critères : solde disponible/en attente/versé correct · retrait bloqué sous le seuil minimum configuré.

**T8.4** En tant que Super-Admin, je veux configurer les taux et le mode de commission d'affiliation, afin de piloter le coût du programme.
Critères : configuration appliquée globalement, avec possibilité de surcharge par affilié · anti-fraude (détection auto-parrainage) fonctionnelle.

### SPRINT 9 — Dashboard Super-Admin complet

**T9.1** En tant que Super-Admin, je veux voir la liste de toutes les boutiques avec leur statut et abonnement, afin de superviser la plateforme.
Critères : filtres avancés fonctionnels · fiche détaillée par boutique accessible.

**T9.2** En tant que Super-Admin, je veux une vue consolidée de toutes les transactions de la plateforme, afin de suivre les revenus et litiges.
Critères : filtres par période/pays/agrégateur/statut · détail commission/montant net correct.

**T9.3** En tant que Super-Admin, je veux un tableau de bord des revenus (abonnements, commissions, MRR/ARR, churn), afin de piloter la performance business.
Critères : coût du programme d'affiliation déduit visible · export des rapports financiers fonctionnel.

**T9.4** En tant que Super-Admin, je veux un journal d'audit consolidé et des alertes automatiques, afin de superviser la sécurité et la santé de la plateforme.
Critères : alertes expiration/échecs de paiement/anomalies déclenchées correctement.

## PHASE 5 — FINITIONS & LANCEMENT

### SPRINT 10 — QR code client, multi-boutiques, internationalisation

**T10.1** En tant que client final, je veux scanner un QR code sur ma table pour commander, afin de gagner du temps.
Critères : option activable/désactivable par l'exploitant · commande QR traitée comme une commande serveur classique.

**T10.2** En tant qu'exploitant multi-sites, je veux comparer les performances de mes boutiques, afin de piloter mon réseau.
Critères : comparatif multi-boutiques disponible dans les KPI.

**T10.3** En tant qu'utilisateur, je veux que l'application détecte automatiquement mon pays/langue/devise, afin d'utiliser le produit dans mon contexte local.
Critères : tous les textes externalisés (i18n) · sélection manuelle possible.

### SPRINT 11 — Sécurité, tests de charge, préparation au lancement

**T11.1** En tant qu'équipe technique, je veux réaliser un test d'intrusion complet, afin de valider la sécurité avant lancement.
Critères : rapport de pentest sans vulnérabilité critique ouverte · toutes les mesures de cahier-des-charges section 12 vérifiées.

**T11.2** En tant qu'équipe technique, je veux exécuter des tests de charge, afin de valider la scalabilité.
Critères : objectif de disponibilité 99,5% simulé atteint sous charge cible.

**T11.3** En tant qu'équipe produit, je veux un environnement de démonstration finalisé et la documentation utilisateur complète, afin de préparer le lancement commercial.
Critères : tous les livrables de la section 19 (PRD) présents et validés.

---

## Suivi et priorisation

- Chaque sprint dure 2 semaines ; une revue de sprint avec démo est requise en fin de sprint
- Les tickets marqués [sensible] dans api-endpoints.md doivent systématiquement inclure un test vérifiant la génération d'une entrée AuditLog
- En cas de dépendance bloquante entre tickets (ex. T3.1 dépend du schéma Payment livré en Sprint 0), la dépendance doit être signalée explicitement dans l'outil de suivi de projet avant le démarrage du sprint concerné

---

*Ce backlog est une proposition de séquencement priorisé ; le Product Owner peut réordonner les tickets à l'intérieur d'une même phase selon les retours utilisateurs, sans changer l'ordre des phases elles-mêmes (chaque phase dépend techniquement de la précédente).*
