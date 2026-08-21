# DebitManager (Bar Maquis Master) 🍺

Plateforme SaaS mobile-first & web de gestion de bars, maquis, restaurants, boîtes de nuit et lounges en Afrique de l'Ouest — **GitHub · Supabase · Vercel**.

Documentation de référence complète (8 documents) dans [`docs/`](docs/) : PRD, modèle de données, matrice de permissions, design system, cahier des charges, backlog, contrat API, user flows.

## 🏗️ Architecture

| Brique | Technologie | Emplacement |
|---|---|---|
| Web (dashboards boutique, Super-Admin, affilié, menu QR client) | React + TypeScript + Vite + Tailwind | [`web/`](web/) |
| Backend / données / auth / temps réel | **Supabase** (PostgreSQL + RLS + Auth + Realtime + Edge Functions) | [`supabase/`](supabase/) |
| Mobile (Android/iOS) | Flutter (offline-first, SQLite chiffré) | [`mobile/`](mobile/) |
| Hébergement web | Vercel | `vercel.json` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

## ✨ Fonctionnalités (MVP finalisé)

- **Inscription & comptes** : email/téléphone + OTP, profil auto, parcours exploitant (3 étapes) et employé (code société)
- **Abonnement** : 12 tarifs (4 formules × 3 activités), essai gratuit 14 j, rappels J-7/J-3/J-1, grâce 3 j, suspension, upgrade au prorata
- **Catalogue & stocks** : catégories/types/unités préconfigurés et extensibles, seuils d'alerte/sécurité, mouvements, alertes automatiques
- **Commandes** : panier par table ou à emporter, **mode hors-ligne** (file de sync + dédup `client_generated_id`), ventilation bar/cuisine
- **Paiements** : espèces (atomique : facture légale séquentielle + TVA + stock + trésorerie), mobile money/carte via webhooks **Kkiapay / Moneroo / Cinetpay** (Edge Function + RPC `confirm_payment`, commission plateforme 1%), remboursements tracés
- **Tables** : plan de salle, statuts temps réel, réservations, **menu QR client** public (`/menu/:tableId`, commande `QR_CLIENT`)
- **Personnel & présences** : 11 rôles prédéfinis + permissions modulaires, badgeage **géolocalisé** (rayon configurable, retard 10/30 min, exceptions), plannings
- **Paie** : préparation comptable → validation promoteur → paiement, primes suggérées (performance), bulletins
- **Approvisionnements** : fournisseurs, bons de commande (création → validation → réception → stock), **inventaire physique** avec écarts et interprétation (perte/vol/erreur)
- **Rapports & KPI** : CA jour/semaine/mois, panier moyen, alertes stock, export CSV
- **Affiliation** : inscription publique, lien `/r/CODE` + tracking horodaté, attribution définitive au premier clic, commission configurable (1er paiement/récurrent), délai anti-remboursement, retraits
- **Super-Admin** : tenants, transactions, revenus (MRR, commission 1%), journal d'audit immuable, 2FA
- **UX** : design system tokenisé (couleurs marque, typo, espacements), mode clair/sombre, i18n FR/EN, gros boutons tactiles, bandeau de connexion hors-ligne, **mode démo** sans backend

## 🚀 Mise en route

### 1. Supabase (base de données + auth + temps réel)

1. Créez le projet (ou utilisez `plelharwnppmekntpiqi`).
2. **SQL Editor** → exécutez les migrations **dans l'ordre** :
   - `supabase/migrations/0001_schema.sql` (schéma : 30+ tables, enums, index, triggers)
   - `supabase/migrations/0002_seed.sql` (permissions, 11 rôles, catalogue, tarifs, config affiliation)
   - `supabase/migrations/0003_rls_functions.sql` (RLS multi-tenant, RPC, realtime)
   - `supabase/migrations/0004_operations.sql` (paiements, cycle de vie, badgeage GPS, appros, inventaire, QR)
3. Super-Admin : exécutez `supabase/seed_super_admin.sql` (remplacez l'email), puis « Mot de passe oublié ».
4. Edge Functions (optionnel, paiements) : `supabase functions deploy payment-webhook run-lifecycle` + secrets `WEBHOOK_SECRET`, `CRON_SECRET`.

### 2. Web (Vercel)

```bash
cd web
cp .env.example .env      # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
```

Déploiement Vercel : importer le dépôt (framework Vite), ajouter les 2 variables, déployer. Réécritures SPA incluses (`vercel.json`).

### 3. Mode démo (aucune configuration)

Sans variables Supabase, l'application fonctionne en **mode démo** (persistance locale) : boutique d'exemple pré-remplie (produits, tables, employés, historique de ventes) → parcourez tous les modules immédiatement.

## 🧪 Parcours testables

1. **Exploitant** : inscription → onboarding (activité → infos → formule/essai) → dashboard KPI vivant
2. **Serveur** : commande (panier + table) → encaissement espèces → facture légale → stock décrémenté
3. **Personnel** : ajout d'employés (rôles), badgeage (géolocalisation simulée), historique
4. **Paie** : préparer → suggérer primes → valider → payer (workflow comptable/promoteur)
5. **Appro** : fournisseurs → bon de commande → validation → réception (stock mis à jour) ; inventaire avec écarts
6. **QR client** : `/menu/t1` (table de démo) → commande autonome
7. **Affilié** : `/register?affiliate=1` → lien `/r/CODE` → suivi des gains → retrait
8. **Super-Admin** : `/admin` → tenants, revenus, audit

## 🔒 Sécurité

RLS multi-tenant strict (toute requête filtrée par `tenant_id`), audit immuable (pas de policy UPDATE/DELETE), paiements transactionnels (RPC `security definer`), signatures de webhook, 2FA pour rôles sensibles, secret vault, HTTPS/TLS, OWASP (validation serveur systématique, rate limiting côté Supabase).

## 📦 Prochaines itérations (docs/backlog.md)

- Application mobile Flutter complète (sprints 2–4) : commandes offline, KDS, badgeage GPS
- Réconciliation quotidienne automatique des agrégateurs
- Messagerie interne de groupe, notifications SMS
- Comparatif multi-boutiques, QR générés par table (impression)
