# Mémo — Sélecteur pays et numéros de téléphone

## Objectif
Remplacer la saisie manuelle du préfixe international par un sélecteur de pays avec drapeau et préfixe automatique.

## Livré
Le formulaire de connexion propose les modes E-mail, Téléphone et Établissement. Le mode Téléphone affiche le pays, le drapeau, le préfixe et un champ de numéro national. Les inscriptions propriétaire et membre d’équipe utilisent le même composant. Le numéro MTN MoMo de l’abonnement utilise également ce composant.

## Règle de stockage
Le client envoie le numéro composé avec le préfixe choisi. Les API existantes continuent de normaliser et valider les identifiants internationaux. Les numéros existants de profiles, employees, employee_access_requests, customers, lodging_stays et auth.users ont été nettoyés des espaces, parenthèses et tirets sans changer leur préfixe.

## Vérification
La production conserve les numéros internationaux existants et ne contient plus d’espaces dans les colonnes publiques contrôlées. Le typecheck et le build doivent être validés avant publication.
