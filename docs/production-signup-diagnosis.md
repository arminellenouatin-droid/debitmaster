# Diagnostic inscription DebitManager — 24 août 2026

La page Vercel du projet `debitmaster` affiche « No Environment Variables Added ». Le projet est bien `arminel/debitmaster`, séparé d’Envol Africa Magazine. L’environnement Production n’a donc actuellement aucune variable projet Supabase.

Variables requises pour le fonctionnement SSR et l’inscription :

| Variable | Valeur à utiliser | Environnements |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://plelharwnppmekntpiqi.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publishable du projet Supabase DebitManager | Production, Preview, Development |

La clé doit être récupérée depuis Supabase > Project Settings > API Keys, pour le projet `plelharwnppmekntpiqi`. Ne jamais utiliser la clé `service_role` dans le navigateur ni dans ces variables publiques.
