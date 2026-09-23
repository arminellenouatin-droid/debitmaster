# Mémo — Exigence zone et table pour les commandes

## Objectif
Permettre au propriétaire de chaque établissement d’exiger, ou non, une zone et un numéro de table avant l’envoi d’une commande.

## Périmètre
Le réglage concerne chaque établissement séparément et s’applique aux serveuses et employés autorisés à créer des commandes. Lorsqu’il est activé, la zone et la table sont requises. Lorsqu’il est désactivé, une commande peut être envoyée sans ces informations.

## Décision technique
Réutiliser la colonne existante `companies.zones_tables_enabled`, jusque-là limitée à certains types d’activité. La règle devient indépendante de l’activité. Le propriétaire modifie la préférence depuis le cockpit standard via une route sécurisée réservée au propriétaire.

## Sécurité
L’API de commande relit toujours la préférence depuis la base et ne fait pas confiance au navigateur. L’API de préférence vérifie que l’utilisateur authentifié est propriétaire de l’établissement ciblé.

## Vérification
Typecheck, build, recherche des anciens garde-fous limités à Power, puis publication GitHub et déploiement Vercel.
