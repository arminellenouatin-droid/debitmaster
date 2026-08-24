# Audit Supabase DebitManager — 24 août 2026

Le contrôle a été effectué uniquement sur le projet `plelharwnppmekntpiqi`.

## RLS

Les tables métier `companies`, `categories`, `products`, `stock_movements`, `orders`, `order_items`, ainsi que `profiles`, `employees` et `payments`, disposent de politiques RLS. Les politiques métier ont été restreintes au rôle `authenticated` et utilisent le tenant de la session. La fonction de résolution du tenant a été déplacée de `public.current_tenant_id()` vers `private.current_tenant_id()` afin de ne pas rester exposée via l’API publique. L’advisor Supabase de sécurité renvoie désormais zéro lint.

## Performance

Les advisors signalent des index manquants sur plusieurs clés étrangères, notamment propriétaire de société, utilisateur employé, lignes de commande, paiement lié à une commande, catégorie produit, tenant de profil et produit de mouvement de stock. Ils signalent aussi une optimisation `auth_rls_initplan` sur les politiques de profil et de société. Ces optimisations sont non fonctionnelles : elles visent les plans de requête et la tenue en charge, et doivent être versionnées séparément.

## Limites

Aucun test d’écriture avec compte réel n’a été effectué pendant cet audit. Les politiques RLS doivent être testées avec un utilisateur authentifié associé à un profil et à un tenant. Aucune donnée EAM n’a été lue ou modifiée.
