# Audit de schéma Supabase DebitManager

Le projet Supabase distinct identifié pour DebitManager est `plelharwnppmekntpiqi`, nommé `debitmaster`, en région `eu-central-1`, avec statut `ACTIVE_HEALTHY`. Le projet EAM distinct est `rtfjwpytiuvoekomevpu` et n’a pas été interrogé pour les migrations DebitManager.

La liste des tables publiques montre notamment `companies`, `profiles`, `categories`, `products`, `orders`, `order_items`, `stock_movements`, `employees`, `employee_permissions`, `employee_invitations` et `payments`. Les tables existantes sont RLS-enabled. `companies` utilise un UUID, possède `owner_user_id`, `unique_code`, `activity_type`, `currency`, `status` et les colonnes de suivi. Les clés étrangères des produits, commandes, lignes de commande, stock et employés pointent vers `companies` via `tenant_id`.

Aucune table dédiée au plan de salle n’a été trouvée dans le dépôt local. La table `payments` existe déjà dans le schéma Supabase, mais sa définition détaillée doit être extraite avant de brancher le webhook Moneroo. Le schéma réel doit donc guider les prochaines migrations, sans réutiliser de noms ou de contraintes supposés.

Source d’observation : sortie MCP Supabase `list_projects` et `list_tables` du 24 août 2026, projet `plelharwnppmekntpiqi`.

## Conseillers Supabase après migrations

L’audit sécurité signale deux points à traiter : la fonction `public.accept_employee_invitation(p_token_hash text)` est `SECURITY DEFINER` et reste exécutable par le rôle `authenticated`, et la protection contre les mots de passe compromis est désactivée dans Supabase Auth. La fonction est intentionnelle pour l’acceptation d’invitation, mais son exécution doit être limitée au strict nécessaire et la protection des mots de passe doit être activée dans le panneau Auth.

L’audit performance signale notamment l’absence d’index couvrant la clé étrangère `internal_messages.sender_user_id`. Il signale aussi plusieurs index non encore utilisés, ce qui est normal juste après les migrations et ne justifie pas une suppression avant observation de trafic. La correction retenue est d’ajouter l’index manquant sur l’expéditeur, sans supprimer les index de tenant nécessaires aux futurs parcours.

Remédiations de référence : [fonction SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [clés étrangères non indexées](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
