# DebitManager (Bar Maquis Master) 🍺

Plateforme SaaS mobile-first & web de gestion de bars, maquis, restaurants, boîtes de nuit et lounges en Afrique de l'Ouest — **GitHub · Supabase · Vercel**.

La documentation de référence complète (8 documents) est dans [`docs/`](docs/) :
PRD, modèle de données, matrice de permissions, design system, cahier des charges, backlog, contrat API, user flows.

## 🏗️ Architecture

| Brique | Technologie | Emplacement |
|---|---|---|
| Web (dashboards boutique, Super-Admin, affilié, QR client) | React + TypeScript + Vite + Tailwind | [`web/`](web/) |
| Backend / données / auth / temps réel | **Supabase** (PostgreSQL + RLS + Auth + Realtime + Edge Functions futures) | [`supabase/migrations/`](supabase/migrations/) |
| Mobile (Android/iOS) | Flutter (offline-first, SQLite chiffré) | [`mobile/`](mobile/) (scaffold) |
| Hébergement web | Vercel | `vercel.json` |

## 🚀 Démarrage rapide

### 1. Base de données (Supabase)

1. Créez un projet sur [supabase.com](https://supabase.com) (utilisez `plelharwnppmekntpiqi` si déjà créé).
2. Dans **SQL Editor**, exécutez les migrations **dans l'ordre** :
   - `supabase/migrations/0001_schema.sql` (schéma complet : 30+ tables, enums, index)
   - `supabase/migrations/0002_seed.sql` (permissions, 11 rôles + préréglages, catalogue, tarifs)
   - `supabase/migrations/0003_rls_functions.sql` (RLS multi-tenant, RPC, triggers, realtime)

   > Alternative locale : `supabase start` puis `supabase db push` (CLI Supabase).

3. Créez votre premier **Super-Admin** (dashboard plateforme) en exécutant
   [`supabase/seed_super_admin.sql`](supabase/seed_super_admin.sql) après avoir remplacé l'email,
   puis connectez-vous et utilisez **« Mot de passe oublié »** pour définir le mot de passe.

### 2. Application web (Vercel)

```bash
cd web
cp .env.example .env    # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev             # http://localhost:5173
```

Déploiement Vercel :
1. Importez le dépôt GitHub dans [vercel.com](https://vercel.com) (framework : Vite).
2. Ajoutez les variables d'environnement `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. Déployez — les réécritures SPA sont déjà dans `vercel.json`.

### 3. Sans configuration (mode démo)

Si les variables Supabase ne sont pas renseignées, l'app démarre en **mode démo**
(persistance locale) pour parcourir toute l'UI : inscription → création boutique →
essai 14 j → produits → commande → encaissement → facture légale → affiliation → Super-Admin.

## 🧪 Parcours testables

1. **Exploitant** : Inscription → création boutique (Buvette/Bar-restaurant/Boîte de nuit) → formule + essai 14 j → dashboard KPI.
2. **Serveur** : prise de commande (panier, table) → encaissement espèces → facture PDF (numéro légal séquentiel) + décrément de stock.
3. **Produits** : catalogue préconfiguré (5 catégories, 15 types, 6 unités), seuils d'alerte, réappro / pertes.
4. **Tables** : plan de salle, statuts libre/occupée/réservée/à nettoyer.
5. **Affilié** : inscription publique → lien de parrainage `/r/CODE` → tracking du clic → attribution.
6. **Super-Admin** : liste des tenants, revenus (abonnements, commission 1%, MRR), journal d'audit.

## 🔒 Sécurité (implémentée côté base)

- **RLS multi-tenant** : chaque requête filtrée par `tenant_id` via `get_my_tenant_id()` (security definer).
- **Audit immuable** : `audit_logs` sans policy UPDATE/DELETE ; les actions sensibles (création boutique, encaissement, etc.) y écrivent.
- **Paiement atomique** : RPC `record_cash_payment` (facture + numéro séquentiel + paiement + trésorerie + stock) en une transaction.
- **Affiliation anti-fraude** : attribution au premier code, statut `ACTIVE` requis, tracking horodaté avec expiration.
- **2FA** : exigé pour Promoteur/Comptable/Super-Admin (activation dans Auth Supabase + vérification côté app).

## 📦 Prochaines itérations (backlog `docs/backlog.md`)

- Paiements mobile money / carte (Kkiapay, Moneroo, Cinetpay) via webhooks + réconciliation.
- Application mobile Flutter complète (`mobile/`).
- Badgeage géolocalisé, paie, inventaire, KDS temps réel (Realtime déjà activé sur `orders`).
- Edge Functions Supabase pour les webhooks et la réconciliation quotidienne.
