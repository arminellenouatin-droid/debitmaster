# Contrat API — Endpoints par module — DebitManager

**Objectif du document :** définir le contrat backend/frontend de référence (API REST + WebSocket) afin d'éviter toute divergence entre les agents backend, mobile et web.

## Conventions générales

- **Base URL :** `/api/v1`
- **Format :** JSON, `Content-Type: application/json`
- **Authentification :** Bearer token (JWT à durée courte) + refresh token dédié ; header `Authorization: Bearer <token>`
- Toutes les routes (sauf celles marquées `public`) exigent un utilisateur authentifié et vérifient le `tenant_id` de la ressource contre celui de l'utilisateur (isolation multi-tenant), sauf pour les routes Super-Admin
- **Codes de retour standards :** 200 succès, 201 créé, 400 requête invalide, 401 non authentifié, 403 permission refusée, 404 non trouvé, 409 conflit (ex. synchronisation offline), 422 validation métier échouée, 429 rate limit atteint
- **Pagination standard** sur les listes : `?page=`, `?per_page=`, réponse avec `data`, `meta.total`, `meta.page`
- Toute route marquée **[sensible]** doit générer une entrée `AuditLog`
- Toute route marquée **[offline]** doit être supportée par le moteur de synchronisation mobile (idempotence via `client_generated_id`)

## 1. AUTHENTIFICATION & COMPTE

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | /auth/register | Inscription (téléphone/email + mot de passe ou social) | public |
| POST | /auth/otp/send | Envoi du code OTP par SMS | public |
| POST | /auth/otp/verify | Vérification du code OTP | public |
| POST | /auth/login | Connexion (email/téléphone + mot de passe) | public |
| POST | /auth/login/2fa | Validation du second facteur | public |
| POST | /auth/refresh | Rafraîchissement du token de session | authentifié (refresh token) |
| POST | /auth/logout | Déconnexion, révocation de session | authentifié |
| POST | /auth/logout/all-devices | Révocation de toutes les sessions actives **[sensible]** | authentifié |
| POST | /auth/password/forgot | Demande de réinitialisation de mot de passe | public |
| POST | /auth/password/reset | Réinitialisation avec token | public |
| GET | /me | Profil de l'utilisateur connecté (droits inclus) | authentifié |
| PATCH | /me | Mise à jour du profil | authentifié |

## 2. ENTREPRISES / BOUTIQUES (TENANTS)

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | /companies | Créer une boutique (parcours exploitant) | authentifié |
| GET | /companies/:id | Détail d'une boutique | rôle avec company.edit_settings ou propriétaire |
| PATCH | /companies/:id | Modifier config boutique (nom, logo, adresse…) **[sensible]** | company.edit_settings |
| GET | /companies/:id/join-code | Récupérer le code société | company.edit_settings |
| POST | /companies/join | Un employé rejoint une boutique via code | authentifié |
| GET | /companies/:id/categories /types /units | Listes préconfigurées + extensions | authentifié (tenant) |
| POST | /companies/:id/categories /types /units | Créer une catégorie/type/unité personnalisée | company.manage_categories_types_units |

## 3. ABONNEMENTS

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /companies/:id/subscriptions | Historique des abonnements | subscription.view |
| GET | /subscriptions/plans | Grille tarifaire courante | public |
| POST | /subscriptions | Souscrire à une formule (déclenche paiement) | subscription.change_plan_pay |
| POST | /subscriptions/:id/change-plan | Changer de formule (prorata) | subscription.change_plan_pay |
| GET | /subscriptions/:id/invoice | Facture d'abonnement PDF | subscription.view |
| POST | /subscriptions/trial/start | Démarrer la période d'essai 14 jours | authentifié (exploitant) |

## 4. UTILISATEURS, EMPLOYÉS, RÔLES

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /employees | Liste des employés de la boutique | employees.view |
| POST | /employees | Créer un compte employé directement | employees.create |
| GET | /employees/pending | Liste des inscriptions en attente | employees.validate_signup |
| POST | /employees/:id/validate | Valider une inscription employé **[sensible]** | employees.validate_signup |
| POST | /employees/:id/reject | Rejeter une inscription employé | employees.validate_signup |
| PATCH | /employees/:id | Modifier fiche employé | employees.manage_permissions |
| DELETE | /employees/:id | Désactiver un employé **[sensible]** | employees.manage_permissions |
| GET | /roles | Liste des rôles/profils de la boutique | authentifié (tenant) |
| POST | /roles | Créer un profil personnalisé | roles.create_custom_profile |
| PATCH | /roles/:id/permissions | Modifier les permissions d'un rôle **[sensible]** | roles.create_custom_profile |
| GET | /permissions | Liste de toutes les permissions système | authentifié (tenant) |

## 5. PLANNINGS & PRÉSENCES

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /employees/:id/schedule | Planning d'un employé | schedules.manage ou soi-même |
| POST | /employees/:id/schedule | Définir/modifier planning | schedules.manage |
| POST | /attendance/check-in | Badgeage entrée (géolocalisation incluse) **[offline]** | authentifié (employé) |
| POST | /attendance/check-out | Badgeage sortie **[offline]** | authentifié (employé) |
| POST | /attendance/:id/exception | Accorder une exception de retard/absence **[sensible]** | attendance.grant_exception |
| GET | /attendance | Historique des présences (filtrable) | attendance.view_all ou soi-même |
| POST | /leaves | Demande de congé/absence | authentifié (employé) |
| POST | /leaves/:id/approve | Approuver une demande de congé | leaves.approve |

## 6. PRODUITS, STOCKS, APPROVISIONNEMENTS

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /products | Liste des produits (filtrable par catégorie) | authentifié (tenant) |
| POST | /products | Créer un produit | products.manage |
| PATCH | /products/:id | Modifier un produit (prix, seuils…) **[sensible]** | products.manage |
| GET | /products/:id/price-history | Historique des changements de prix | products.manage |
| DELETE | /products/:id | Supprimer (soft delete) un produit | products.manage |
| GET | /stock/movements | Historique des mouvements de stock | stock.view |
| POST | /stock/movements | Enregistrer un mouvement (perte, casse…) **[sensible]** | stock.record_movement |
| GET | /suppliers | Liste des fournisseurs | suppliers.manage |
| POST | /suppliers | Créer un fournisseur | suppliers.manage |
| GET | /purchase-orders | Liste des bons de commande | purchase_order.create ou .validate |
| POST | /purchase-orders | Créer un bon de commande | purchase_order.create |
| POST | /purchase-orders/:id/validate | Valider un bon de commande **[sensible]** | purchase_order.validate |
| POST | /purchase-orders/:id/receive | Enregistrer la réception marchandise | purchase_order.receive |
| GET | /inventories | Liste des inventaires physiques | inventory.perform |
| POST | /inventories | Démarrer un inventaire | inventory.perform |
| POST | /inventories/:id/lines | Saisir les quantités réelles | inventory.perform |
| POST | /inventories/:id/complete | Clôturer l'inventaire (calcul des écarts) | inventory.perform |
| GET | /inventories/:id/report | Rapport d'écarts | inventory.view_discrepancy_report |

## 7. TABLES & COMMANDES

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /tables | Liste des tables et statuts | authentifié (tenant) |
| POST | /tables | Créer une table | tables.configure_plan |
| PATCH | /tables/:id/status | Mettre à jour le statut d'une table | tables.update_status |
| POST | /tables/:id/reservations | Créer une réservation | tables.reserve |
| POST | /orders | Créer une commande **[offline]** | orders.create |
| GET | /orders | Liste des commandes (filtrable par statut/section) | orders.view_all ou soi-même |
| GET | /orders/:id | Détail d'une commande | orders.view_all ou soi-même |
| POST | /orders/:id/items/:itemId/assign | Attribuer une ligne à un exécutant | orders.assign_section |
| POST | /orders/:id/items/:itemId/ready | Marquer une ligne prête | orders.mark_ready |
| POST | /orders/:id/transfer | Transférer une commande vers une autre table | orders.transfer_table |
| POST | /orders/:id/cancel | Demander une annulation | orders.cancel |
| POST | /orders/:id/cancel/approve | Valider une annulation **[sensible]** | orders.approve_cancel |
| POST | /orders/qr | Créer une commande via QR client | public (scan table) |

## 8. FACTURATION & PAIEMENTS

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | /orders/:id/invoice | Générer la facture d'une commande | invoices.view |
| GET | /invoices/:id | Détail/PDF d'une facture | invoices.view |
| POST | /payments/cash | Enregistrer un paiement espèces | payments.take_cash |
| POST | /payments/mobile-money | Initier un paiement mobile money | payments.take_card_mobile |
| POST | /payments/card | Générer un lien de paiement carte (agrégateur) | payments.take_card_mobile |
| POST | /payments/webhooks/kkiapay | Webhook confirmation Kkiapay | public (signature vérifiée) |
| POST | /payments/webhooks/moneroo | Webhook confirmation Moneroo | public (signature vérifiée) |
| POST | /payments/webhooks/cinetpay | Webhook confirmation Cinetpay | public (signature vérifiée) |
| POST | /payments/:id/refund | Rembourser un paiement **[sensible]** | payments.refund_approve |
| GET | /payments/reconciliation | État de la réconciliation quotidienne | rôle comptable |

## 9. PAIE

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /payroll | Liste des paies par période | payroll.view_all |
| POST | /payroll | Préparer la paie d'un employé | payroll.prepare |
| POST | /payroll/:id/validate | Valider la paie **[sensible]** | payroll.validate |
| POST | /payroll/:id/pay | Déclencher le paiement mobile money/virement | payroll.validate |
| GET | /payroll/:id/payslip | Bulletin de salaire PDF | payroll.view_own_payslip |
| GET | /payroll/bonus-suggestions | Suggestions automatiques de primes | payroll.configure_bonus_rules |

## 10. TRÉSORERIE & COMPTABILITÉ

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /treasury/movements | Historique des mouvements de trésorerie | treasury.view_consolidated |
| POST | /treasury/withdrawals | Demander un retrait de fonds **[sensible]** | treasury.withdraw_funds |
| GET | /accounting/expenses | Liste des dépenses | accounting.manage_expenses |
| POST | /accounting/expenses | Enregistrer une dépense | accounting.manage_expenses |
| GET | /accounting/reports | Rapports comptables (période) | accounting.export_reports |
| GET | /accounting/reports/export | Export CSV/Excel/PDF | accounting.export_reports |

## 11. NOTIFICATIONS & COMMUNICATION

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /notifications | Liste des notifications de l'utilisateur | authentifié |
| POST | /notifications/:id/read | Marquer comme lue | authentifié |
| POST | /messages | Envoyer un message (individuel/groupe) | messages.send_individual ou .send_group |
| GET | /messages | Historique des messages | messages.view_history |

## 12. RAPPORTS & KPI

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /reports/kpi/global | KPI globaux boutique | reports.view_global_kpi |
| GET | /reports/kpi/me | KPI personnels (serveur, magasinier…) | reports.view_own_performance |
| GET | /reports/kpi/financial | KPI financiers | reports.view_financial |
| GET | /reports/kpi/stock | KPI stocks/inventaire | reports.view_stock_kpi |
| GET | /reports/export | Export PDF/Excel d'un rapport | reports.export |

## 13. PROGRAMME D'AFFILIATION

| Méthode | Route | Description | Accès |
|---|---|---|---|
| POST | /affiliates/register | Inscription publique affilié | public |
| GET | /affiliates/me | Profil et statut de l'affilié connecté | authentifié (affilié) |
| GET | /affiliates/me/referral-link | Lien/code de parrainage + QR code | authentifié (affilié) |
| GET | /affiliates/me/referrals | Liste des boutiques parrainées + statut | authentifié (affilié) |
| GET | /affiliates/me/commissions | Détail des commissions (en attente/validées/versées) | authentifié (affilié) |
| POST | /affiliates/me/payout-requests | Demander un retrait | authentifié (affilié) |
| GET | /referral/:code | Résolution publique d'un lien de parrainage (tracking) | public |

## 14. SUPER-ADMIN — PLATEFORME

| Méthode | Route | Description | Accès |
|---|---|---|---|
| GET | /admin/companies | Liste de toutes les boutiques (filtrable) | Super-Admin |
| GET | /admin/companies/:id | Fiche détaillée d'une boutique | Super-Admin |
| POST | /admin/companies/:id/suspend | Suspendre une boutique **[sensible]** | Super-Admin |
| POST | /admin/companies/:id/reactivate | Réactiver une boutique **[sensible]** | Super-Admin |
| GET | /admin/transactions | Vue globale de toutes les transactions plateforme | Super-Admin |
| POST | /admin/transactions/:id/refund | Traiter un remboursement exceptionnel **[sensible]** | Super-Admin |
| GET | /admin/revenue/dashboard | Revenus abonnements + commissions, MRR/ARR, churn | Super-Admin |
| GET | /admin/pricing | Grille tarifaire actuelle | Super-Admin |
| PATCH | /admin/pricing | Modifier la grille tarifaire globale **[sensible]** | Super-Admin |
| GET | /admin/affiliates | Liste de tous les affiliés | Super-Admin |
| POST | /admin/affiliates/:id/validate | Valider un affilié **[sensible]** | Super-Admin |
| POST | /admin/affiliates/:id/suspend | Suspendre un affilié **[sensible]** | Super-Admin |
| PATCH | /admin/affiliate-program/config | Configurer taux/mode de commission d'affiliation **[sensible]** | Super-Admin |
| GET | /admin/affiliates/payout-requests | Liste des demandes de retrait | Super-Admin |
| POST | /admin/affiliates/payout-requests/:id/process | Traiter un retrait **[sensible]** | Super-Admin |
| GET | /admin/audit-log | Journal d'audit consolidé plateforme | Super-Admin |
| GET | /admin/support-tickets | Liste des tickets support | Super-Admin |
| POST | /admin/support-tickets/:id/reply | Répondre à un ticket | Super-Admin |
| GET | /admin/internal-accounts | Comptes internes équipe DebitManager | Super-Admin (droit dédié) |
| POST | /admin/internal-accounts | Créer un compte interne **[sensible]** | Super-Admin (droit dédié) |

## 15. WEBSOCKET (TEMPS RÉEL)

| Canal | Événement | Description |
|---|---|---|
| orders:{tenant_id} | order.created / order.ready / order.cancelled | Mise à jour temps réel des écrans commande/KDS |
| stock:{tenant_id} | stock.alert_triggered | Alerte seuil atteint |
| attendance:{tenant_id} | attendance.checked_in | Notification badgeage en temps réel au superviseur |
| notifications:{user_id} | notification.new | Poussée d'une notification en temps réel |

---

*Ce contrat API est la référence pour l'implémentation backend et la consommation frontend/mobile. Toute route additionnelle découverte en cours de développement doit être ajoutée ici avant d'être codée, avec son niveau d'accès (permission requise).*
