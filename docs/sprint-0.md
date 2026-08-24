# DebitManager — Sprint 0

## Objectif

Transformer les instructions locales en une base technique vérifiable, sans ajouter de données fictives et sans modifier la base Supabase de production avant validation.

## Travaux

| Ordre | Travail | Preuve attendue |
|---|---|---|
| 1 | Initialiser le socle Next.js et TypeScript | Build reproductible et lint |
| 2 | Configurer les variables d’environnement | `.env.example` sans secret réel |
| 3 | Établir les contrats Auth, Tenants, Abonnements et Catalogue | Routes documentées et schémas d’entrée |
| 4 | Mettre en place la couche Supabase serveur | Client serveur, contrôle session et tenant |
| 5 | Construire le shell dashboard responsive | Navigation par rôle, loading, empty et error states |
| 6 | Ajouter les tests du parcours exploitant | Tests unitaires, intégration et parcours critique |
| 7 | Préparer CI et déploiement | Vérifications automatiques et rollback documenté |

## Parcours vertical cible

Un exploitant arrive sur l’application, crée son compte, vérifie sa session, crée son établissement, choisit une configuration d’abonnement affichée sans paiement réel, arrive sur son dashboard et crée un premier produit. À chaque étape, le système doit expliquer ce qui est requis, afficher les erreurs au bon endroit et empêcher l’accès à un tenant qui ne lui appartient pas.

## Risques prioritaires

Le dépôt GitHub est actuellement presque vide alors que Supabase possède déjà un schéma et des données. Le risque principal est de coder sur une base locale qui ne correspond pas au schéma distant. Le second est l’exposition de `public.current_tenant_id()` en `SECURITY DEFINER` aux rôles publics. Le troisième est la confusion possible entre les spécifications Next.js/Supabase et le template WebDev tRPC/Drizzle. L’architecture finale devra suivre le contrat réellement retenu et non mélanger les deux piles.

## Critères d’acceptation

Le Sprint 0 est accepté lorsque le projet est installé depuis le dépôt, que l’environnement est documenté, que le build passe, que les routes prioritaires sont listées, que les rôles et frontières tenant sont écrits, qu’aucune donnée réelle n’est modifiée, et que le premier parcours possède des tests ou des scénarios reproductibles.

## Décision à confirmer avant Sprint 1

Le code local doit être confirmé comme source de vérité. Si le dossier local ne contient pas encore l’application, il faudra créer le socle dans le dépôt GitHub `debitmaster`; si une application existe ailleurs, il faudra d’abord la synchroniser proprement plutôt que reconstruire deux codebases concurrentes.
