# Mémo E2E DebitMaster — 20 septembre 2026

## Objectif
Tester les parcours propriétaire, membre d’équipe et affilié sur la production DebitMaster, puis corriger les défauts reproductibles sans exposer ni modifier de données privées.

## Périmètre
Inclus : pages publiques, inscription propriétaire, inscription membre avec code établissement, connexion, inscription/connexion affilié, garde-fous d’erreur, routes HTTP et build. Hors périmètre : confirmation via boîte mail privée, création d’établissement après activation, ajout de personnel et attribution de droits tant qu’un compte propriétaire de test n’est pas confirmé.

## Décisions
- Utiliser un compte de test dédié avec un domaine e-mail réel ; les domaines d’exemple sont rejetés par Supabase.
- Ne pas ouvrir la messagerie privée du navigateur ni inspecter les données d’un compte prérempli.
- Corriger uniquement le défaut UX confirmé : messages d’erreur obsolètes après modification d’un champ.

## Sécurité
- Les routes métier restent protégées sans session.
- Le code établissement invalide est rejeté côté serveur.
- Une session préremplie par le navigateur a été ouverte par inadvertance pendant un test de connexion ; déconnexion immédiate effectuée, aucune modification ni lecture métier poursuivie.

## État final
- Inscription propriétaire : compte créé, confirmation e-mail requise.
- Inscription membre : formulaire et rejet du code invalide vérifiés.
- Affiliation : inscription/connexion et bascule des modes vérifiées visuellement.
- Correctif local appliqué dans `src/app/inscription/InscriptionForm.tsx`.
- Typecheck, build et `git diff --check` réussis.
- Reprise E2E complète à effectuer après confirmation du compte de test.


## Reprise du 21 septembre 2026

Le commit `cea2a08` a été publié et déployé en production avec état Vercel `READY`. Le propriétaire de test peut maintenant créer son compte sans confirmation e-mail et est redirigé vers le choix de profil. Le parcours de création d’établissement a été exécuté avec succès jusqu’au tableau de bord en statut Essai : activité Bar & restaurant, Côte d’Ivoire, FCFA, établissement `Etablissement E2E NoConfirm`.

Le module Personnel est accessible et expose l’ajout direct, les rôles et les informations de connexion temporaires. Le navigateur connecté réinjecte toutefois ses anciennes valeurs autofillées pendant les re-rendus ; la création directe d’un employé et sa connexion doivent être rejouées dans un profil vierge. Les erreurs runtime Vercel des sept derniers jours sont absentes.

La recette propriétaire est donc validée jusqu’au dashboard. Restent à valider dans un environnement propre : code établissement réel, demande d’accès employé, approbation, connexion employé, droits détaillés et génération/utilisation du lien affilié.
