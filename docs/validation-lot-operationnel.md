# Validation du lot opérationnel

La page d’accueil locale respecte les tokens de la maquette : surface bleu ivoire, vert profond, ambre, hiérarchie compacte et CTA lisibles. La page d’inscription présente une carte claire, une progression en deux étapes, les champs téléphone/e-mail/mot de passe et un retour explicite vers la connexion. La page choixprofil expose deux parcours distincts : création de boutique et rattachement à une boutique existante.

Les routes métier Orders, Tables, Paiement, Cuisine, Stock, Personnel, Finance, Messages et Settings sont protégées par la session SSR. Une navigation vers `/dashboard/orders` sans session redirige vers `/connexion?next=%2Fdashboard%2Forders`, ce qui confirme que le shell métier n’est pas accessible anonymement.

Le build de production a généré les routes suivantes sans erreur TypeScript : `/dashboard/orders`, `/dashboard/tables`, `/dashboard/payment`, `/dashboard/kitchen`, `/dashboard/stock`, `/dashboard/personnel`, `/dashboard/finance`, `/dashboard/messages` et `/dashboard/settings`. Les modules utilisent les APIs existantes et affichent des états vides explicites lorsque les données réelles sont absentes.

Limite connue : la migration `20260824_internal_messages.sql` doit être appliquée dans Supabase avant d’utiliser la messagerie en production. De même, le bouton Moneroo reste une étape d’interface tant que les identifiants et le webhook du compte marchand ne sont pas connectés.
