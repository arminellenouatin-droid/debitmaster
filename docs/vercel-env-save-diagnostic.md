# Diagnostic enregistrement variables Vercel

Le projet ciblé est `arminel/debitmaster`, celui qui sert `https://debitmaster.vercel.app`.

La page affiche actuellement le formulaire Add Environment Variable avec deux lignes remplies : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. L’environnement affiché est `Production and Preview`. Après clic sur Save, Vercel affiche `No environment variables were created` et conserve le formulaire.

Une inspection DOM indique qu’un contrôle checkbox existe pour le marquage `Sensitive`. Le formulaire doit être testé avec ce marquage désactivé pour des variables `NEXT_PUBLIC_*`, puis avec une seule variable à la fois si nécessaire.

Le contrôle `add-form-sensitive` était activé par défaut et a été désactivé via le formulaire. Les deux variables restent saisies et l’environnement Production and Preview reste sélectionné. Prochaine action : enregistrer à nouveau puis vérifier la liste des variables.

Le déploiement Production le plus récent est READY et correspond au commit `5a60bc3` (fusion de la PR #5). La tentative d’ajout de `NEXT_PUBLIC_SUPABASE_URL` a retourné que la variable existe déjà pour la cible `preview,production`. La tentative d’ajout de `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a retourné le même message de doublon. Les variables sont donc présentes dans Production/Preview ; le message `No Environment Variables Added` de la liste semble être un problème d’affichage/filtre Vercel et non une absence réelle.

La page Vercel actualisée affiche bien `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, toutes deux ciblées sur `Production and Preview`, ajoutées il y a environ 18 minutes. Le dernier déploiement Production `5a60bc3` était antérieur à leur ajout. La production doit donc être redéployée pour que les fonctions serverless reçoivent ces variables.

Après redéploiement Production `273f7H1RrYbhi2cEi3QXPgKWKx9V`, l’API publique `/api/auth/signup` ne renvoie plus `503 Configuration Supabase absente`. Elle renvoie `400` avec le probe volontairement invalide, et les cookies SSR Supabase sont émis. Cela confirme que la configuration Supabase est désormais chargée en production et que la validation peut atteindre Supabase. Aucun compte de test n’a été créé.
