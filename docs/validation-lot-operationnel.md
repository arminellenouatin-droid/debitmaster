# Validation du lot opérationnel

La page d’accueil locale respecte les tokens de la maquette : surface bleu ivoire, vert profond, ambre, hiérarchie compacte et CTA lisibles. La page d’inscription présente une carte claire, une progression en deux étapes, les champs téléphone/e-mail/mot de passe et un retour explicite vers la connexion. La page choixprofil expose deux parcours distincts : création de boutique et rattachement à une boutique existante.

Les routes métier Orders, Tables, Paiement, Cuisine, Stock, Personnel, Finance, Messages et Settings sont protégées par la session SSR. Une navigation vers `/dashboard/orders` sans session redirige vers `/connexion?next=%2Fdashboard%2Forders`, ce qui confirme que le shell métier n’est pas accessible anonymement.

Le build de production a généré les routes suivantes sans erreur TypeScript : `/dashboard/orders`, `/dashboard/tables`, `/dashboard/payment`, `/dashboard/kitchen`, `/dashboard/stock`, `/dashboard/personnel`, `/dashboard/finance`, `/dashboard/messages` et `/dashboard/settings`. Les modules utilisent les APIs existantes et affichent des états vides explicites lorsque les données réelles sont absentes.

Limite connue : la migration `20260824_internal_messages.sql` doit être appliquée dans Supabase avant d’utiliser la messagerie en production. De même, le bouton Moneroo reste une étape d’interface tant que les identifiants et le webhook du compte marchand ne sont pas connectés.

## Contrôle production du 24 août 2026

Le projet Vercel `debitmaster` (`prj_kxoPaaNCBScUEGscmIRPxYKO3G6W`) est lié au dépôt GitHub `arminellenouatin-droid/debitmaster`. Le dernier déploiement production `dpl_4ZiCjo2Bjk9PTt1msRmHwA7ku2My` est en état `READY`, avec l’alias public `https://debitmaster.vercel.app` et le commit fusionné de la PR #11.

La page publique `/` répond HTTP 200. La route `/dashboard/tables` sans session est correctement servie par la page `/connexion`, ce qui confirme la protection d’authentification du parcours en production.

## Tests API production

Le 24 août 2026, `GET /api/orders` sans session répond `401 Authentification requise`. `PATCH /api/orders` avec un payload de transition correctement formé mais sans session répond également `401 Authentification requise`. `POST /api/orders` avec une liste vide est rejeté en amont par `400 Établissement et au moins une ligne de commande requis`, sans insertion en base. L’endpoint Moneroo avec les champs exacts `tenantId` et `orderId`, mais sans session, répond `401 Authentification requise`.

Ces contrôles confirment les garde-fous de forme et d’authentification sans créer de données de test en production.

## Erreurs runtime Vercel observées sur les dernières 24 heures

Le regroupement Vercel signale deux groupes historiques sur d’anciens déploiements : neuf erreurs `companies.POST` liées à une valeur dépassant `varchar(10)` sur le déploiement `dpl_BTgCzS7ytnGbrQCNdh2rAZY2Sh43`, et six erreurs d’inscription indiquant une configuration Supabase absente sur le déploiement `dpl_4FMRZzbuKen3fLET5MfRB2yfFiEu`. Ces erreurs précèdent les corrections déjà fusionnées et ne correspondent pas au dernier déploiement production contrôlé après la PR #12. Elles restent conservées comme trace de diagnostic afin de vérifier qu’elles ne réapparaissent pas.
