# DebitManager — Architecture cible du Sprint 0

## Décision

Le projet sera construit en monolithe modulaire Next.js avec TypeScript, Supabase pour PostgreSQL, Auth et stockage, et Vercel pour l’exécution et le déploiement. Cette forme limite les opérations distribuées au démarrage tout en gardant des frontières de modules nettes. Les routes HTTP prévues dans le contrat API restent la façade métier ; les accès à la base passent par des services serveur typés.

## Modules

| Module | Responsabilité | Première livraison |
|---|---|---|
| Authentification | Inscription, connexion, session, récupération | Oui |
| Tenants | Entreprise, boutique, abonnement et configuration | Oui |
| Catalogue | Catégories et produits | Oui |
| Commandes | Panier, commande et statuts | Ensuite |
| Stocks | Inventaire, mouvements et alertes | Ensuite |
| Personnel | Employés, rôles et permissions | Ensuite |
| Finance | Paiements, trésorerie, paie et rapports | Ensuite |
| Plateforme | Super-admin, affiliés, audit et KPI | Ensuite |

## Flux de données

Le navigateur appelle uniquement les routes de l’application. La route valide la session et le rôle, contrôle le `tenant_id`, valide les entrées et appelle un service métier. Le service utilise Supabase côté serveur ou une requête SQL paramétrée. Les réponses ne contiennent que les champs nécessaires. Les événements critiques sont journalisés sans secret ni donnée bancaire complète.

## Multi-tenant

Chaque table métier porte un `tenant_id` lorsque cela est pertinent. Toute lecture et toute mutation sont filtrées par le tenant de la session. RLS est activé dans Supabase et constitue une seconde barrière, pas un remplacement du contrôle serveur. Les fonctions SQL exposées doivent avoir des privilèges minimaux et ne doivent pas être exécutables anonymement sans justification.

## Authentification et autorisation

Les sessions utilisent des cookies sécurisés, HttpOnly, SameSite approprié et expiration contrôlée. Les permissions sont vérifiées côté serveur pour chaque action, puis reflétées dans l’interface. Les rôles boutique ne sont jamais confondus avec le super-admin de la plateforme.

## Paiements

Les montants métier sont conservés dans leur devise source. Le prestataire de paiement reçoit uniquement les paramètres nécessaires. Les webhooks sont vérifiés, idempotents et rapprochés par une référence interne. Aucune donnée complète de carte bancaire n’est stockée.

## Déploiement et reprise

GitHub `main` est la source de vérité. Les branches de sprint passent par compilation, tests, revue et déploiement de prévisualisation avant production. Les migrations sont versionnées, appliquées séparément et réversibles lorsque possible. Avant toute migration de production, une sauvegarde vérifiée et un plan de retour arrière sont obligatoires.
