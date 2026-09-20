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
