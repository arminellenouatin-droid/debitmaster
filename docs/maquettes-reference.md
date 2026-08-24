# Référence de maquettes DebitManager

Ce document est la source de vérité visuelle et structurelle pour la prochaine refonte. Les fichiers proviennent du dossier utilisateur `DEBITMANAGERFINAL/maquettes` et sont conservés dans `reference-maquettes/`.

## Direction visuelle à respecter

Les écrans utilisent une surface claire bleu ivoire (`#f9f9ff`), un vert profond de marque (`#003426`), un or ambré pour les actions secondaires et alertes (`#7d5700`), des surfaces blanches, des bordures légères et la famille Inter. L’interface combine une barre latérale persistante sur ordinateur, un accès compact sur mobile, des indicateurs d’état explicites et des actions métier directement visibles. Les composants utilisent des rayons modestes, des séparations nettes et des contrastes forts. Ne pas revenir à l’ancienne page blanche éditoriale dispersée.

## Écrans fournis

| Fichier | Écran de référence | Parcours ou module |
|---|---|---|
| `accueilmarketing` | Accueil marketing DebitManager Pro | Découverte, proposition de valeur, accès inscription/connexion |
| `inscription` | Create Account | Inscription en deux étapes, téléphone puis code OTP à quatre chiffres |
| `choixprofil` | Choix du profil | Sélection du contexte utilisateur et du rôle |
| `creationboutique` | Company Information, puis Subscription & Payment | Création établissement en étapes, formule et paiement |
| `tableaudeboard` | Dashboard | Chiffre d’affaires, commandes, trésorerie et tendance |
| `prisedecommande` | Order Taking | Catégories produits, sélection de table, panier et prise de commande |
| `ecranapiement` | Paiement | Total, moyens de paiement, montant reçu, rendu et impression |
| `plandesalle` | Floor Plan | Tables, zones, statuts libre/occupée/réservée |
| `fildattentecuisine` | Kitchen Display System | Commandes en temps réel, cuisine/bar, préparation et validation |
| `gestiondesstocks` | Stock Management | Alertes de stock, commandes fournisseurs, valeur et liste produits |
| `gestionpersonnel` | Personnel | Membres, rôles, présence et gestion d’équipe |
| `tresoreriecomptabilite` | Treasury & Accounting | Caisse, flux, salaires et rapports |
| `messagerieinterne` | Messages | Recherche, groupes, conversations et messages internes |
| `profilparametre` | Settings & Profile | Profil, préférences, sécurité et assistance |
| `badgeagepresence` | Présence | Badgeage, statut et historique de présence |

## Ordre des étapes de premier démarrage

Le parcours de référence est : accueil marketing, création de compte avec téléphone, validation OTP, choix du profil, informations de l’établissement, choix d’abonnement et paiement Moneroo, puis tableau de bord. Une fois le tableau de bord atteint, les modules sont accessibles depuis la navigation persistante : Dashboard, Tables, Orders, Stock, Personnel, Finance, Messages, Settings, Support et Logout.

## Règles d’intégration

Les données affichées dans les écrans fonctionnels doivent provenir des APIs DebitManager ou d’un état vide explicite. Les données d’exemple visibles dans les fichiers HTML servent uniquement de référence visuelle et ne doivent pas être insérées dans Supabase. Les routes protégées doivent conserver la session SSR, l’isolation tenant et les contrôles de permission côté serveur.

Sur mobile, la navigation latérale devient une barre inférieure ou un menu compact, les formulaires restent utilisables au pouce, les tableaux se transforment en listes lisibles et les actions principales restent visibles sans zoom. Toutes les pages doivent avoir un état chargement, erreur, vide et succès cohérent.
