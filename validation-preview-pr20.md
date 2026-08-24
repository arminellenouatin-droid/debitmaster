# Validation preview Pull Request #20

## Contrôles réalisés le 24 août 2026

Le preview Vercel `https://debitmaster-p9t5narhb-arminel.vercel.app` est accessible publiquement et affiche correctement la landing page DebitManager. Le rendu desktop est structuré, responsive annoncé, et les liens « Se connecter » et « Créer mon espace » sont présents.

La page `https://debitmaster-p9t5narhb-arminel.vercel.app/connexion` s’ouvre correctement. Elle affiche un formulaire « E-mail ou téléphone », un mot de passe et le bouton « Se connecter ». Aucun test de mot de passe réel n’a été effectué afin de ne pas utiliser de donnée sensible sans instruction explicite.

Le déploiement Vercel lié à la Pull Request #20 est `READY`, branche `feat/server-dashboard-settlement`, commit `6abc9764393e3eec5ccf649e6b95f632abb2a577`, preview `debitmaster-p9t5narhb-arminel.vercel.app`. La production reste sur le dernier merge de la Pull Request #19 tant que la Pull Request #20 n’est pas fusionnée.

## Tests encore requis avec un compte de test

Tester le compte SERVEUR sur le preview, vérifier les tables attribuées, la création client, la création de commande, le suivi `READY/HANDED_OFF/DELIVERED`, l’encaissement cash, l’initialisation Moneroo et la demande de reversement propriétaire. Vérifier aussi l’isolation entre deux serveurs et le rendu mobile.
