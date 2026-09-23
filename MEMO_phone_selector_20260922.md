# Mémo — Sélecteur pays et numéros de téléphone

## Objectif
Remplacer la saisie manuelle du préfixe international par un sélecteur de pays avec drapeau et préfixe automatique.

## Livré
Le formulaire de connexion propose les modes E-mail, Téléphone et Établissement. Le mode Téléphone affiche le pays, le drapeau, le préfixe et un champ de numéro national. Les inscriptions propriétaire et membre d’équipe utilisent le même composant. Le numéro MTN MoMo de l’abonnement utilise également ce composant.

## Règle de stockage
Le client envoie le numéro composé avec le préfixe choisi. Les API existantes continuent de normaliser et valider les identifiants internationaux. Les numéros existants de profiles, employees, employee_access_requests, customers, lodging_stays et auth.users ont été nettoyés des espaces, parenthèses et tirets sans changer leur préfixe.

## Vérification
La production conserve les numéros internationaux existants et ne contient plus d’espaces dans les colonnes publiques contrôlées. Le typecheck et le build doivent être validés avant publication.


## Ajustement du 23 septembre 2026
La connexion ne propose désormais que deux options : **E-mail** et **Téléphone**. La tentative de connexion par nom d’établissement a été retirée de l’interface et de l’API, car le nom d’établissement n’est pas un identifiant lié de façon fiable à l’agent utilisateur.
