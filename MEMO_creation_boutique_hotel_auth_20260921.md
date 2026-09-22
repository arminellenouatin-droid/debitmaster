# Mémo — Activité Hôtel et auberge, création boutique et accès propriétaire

## Objectif
Remplacer l’activité commerciale « Power » par « Hôtel et auberge », enrichir les informations de création d’établissement et rétablir un accès fiable au compte propriétaire de LE TEMPLE DU PLAISIR.

## Périmètre
Inclus : nouveau code d’activité pour les créations, compatibilité des anciens établissements POWER, adresse, ville, IFU, registre de commerce, photo du promoteur et pièce d’identité, validation serveur, stockage privé, correction de la connexion propriétaire et tests de production. Hors périmètre : réinitialisation silencieuse d’un mot de passe sans choix explicite du propriétaire, modification des données métier non liées.

## Décisions techniques
Le nouveau code sera `HOTEL_AUBERGE`, affiché « Hôtel et auberge ». Les lignes existantes POWER seront conservées compatibles pendant la transition. Les pièces d’identité seront stockées dans un bucket privé, avec accès signé et autorisé uniquement au propriétaire concerné. Les nouveaux champs entreprise seront validés côté serveur.

## Sécurité
Les documents sont des données sensibles : types MIME et tailles contrôlés, nom de stockage non contrôlé par l’utilisateur, aucun lien public permanent, accès propriétaire vérifié côté serveur. Aucun mot de passe ne sera créé ou remplacé sans choix explicite.

## Plan
- Auditer l’authentification et les colonnes existantes.
- Ajouter la migration des champs et du stockage privé.
- Corriger le catalogue d’activités et le formulaire de création.
- Corriger la résolution du compte propriétaire et documenter le cas d’identifiants techniques.
- Exécuter typecheck, build, tests SQL et parcours navigateur.

## État final
La migration Supabase a été appliquée le 22 septembre 2026. Le compte test LE TEMPLE DU PLAISIR est désormais classé `HOTEL_AUBERGE`; les champs historiques non renseignés restent null afin de ne pas inventer de données légales. Le bucket `company-documents` est privé.

Le typecheck et le build local sont passés. La production a répondu HTTP 200 après le premier déploiement. L’interface de production affiche bien les quatre activités, dont « Hôtel et auberge », sans afficher Power dans les nouvelles créations. La connexion accepte l’e-mail, le téléphone et le nom exact de l’établissement; le libellé utilisateur a été aligné. Le dernier commit de libellé est publié et attend son déploiement Vercel.


## Réinitialisation ciblée et plans définitifs — 22 septembre 2026
La production ne conserve désormais qu’un seul établissement : **LE TEMPLE DU PLAISIR**, avec l’activité principale **Hôtel et auberge** et le plan **SPECIAL**. Ses activités Boissons, Repas, Auberge, Gym, Lavage et Zone Wi-Fi ont été conservées. Les quatre autres établissements de test et leurs données tenant rattachées ont été supprimés. Les comptes du SUPER_ADMIN SaaS et les trois comptes affiliés ont été vérifiés et conservés.

Le catalogue actif contient uniquement les trois plans standards **BUVETTE**, **BAR_RESTAURANT** et **HOTEL_AUBERGE** avec périodicités mensuelle et annuelle. Le plan **SPECIAL** n’a pas de tarif automatique : il est accessible par demande de cotation avec sélection des activités complémentaires. L’API de paiement refuse désormais un paiement direct du plan SPECIAL et l’interface permet d’envoyer la demande de devis. Les modules Gym, Lavage et Wi-Fi sont contrôlés par le plan SPECIAL, tandis que les boissons, repas et chambres restent déterminés par l’activité principale et les plans standards.
