# Matrice des rôles et permissions — DebitManager

**Objectif du document :** définir, pour chaque droit fonctionnel du système, l'état par défaut (activé/désactivé) pour chacun des profils prédéfinis. Chaque permission est un interrupteur indépendant, modifiable ensuite par l'administrateur de la boutique depuis son dashboard. **Le dashboard et l'espace de travail de chaque utilisateur sont générés dynamiquement selon ses droits : une fonctionnalité non autorisée est invisible, pas seulement grisée.**

## Profils couverts

- **Promoteur** : propriétaire de la boutique, tous les droits par défaut, non désactivables sur les actions critiques (retrait de fonds, résiliation d'abonnement)
- **Administrateur**, **Gérant/Superviseur**, **Serveur/Serveuse**, **Bar man**, **Cuisinier/Chef cuisine**, **Magasinier**, **Chargé des approvisionnements**, **Comptable**, **Secrétaire** (9 profils opérationnels prédéfinis, avec Promoteur = 10, Administrateur déjà compté = 11 profils prédéfinis au total en cohérence avec le cahier des charges)
- Profils hors périmètre de cette matrice (permissions gérées séparément) : **Super-Admin** (accès plateforme, non un rôle de boutique) et **Affilié** (accès à son seul espace d'affiliation)

Légende : ✅ activé par défaut · ❌ désactivé par défaut · ⚙️ activable selon configuration (dépend d'une option boutique, ex. QR code)

Abréviations : PRO = Promoteur · ADM = Administrateur · GER = Gérant/Superviseur · SER = Serveur/Serveuse · BAR = Bar man · CUI = Cuisinier/Chef cuisine · MAG = Magasinier · APP = Chargé des approvisionnements · COM = Comptable · SEC = Secrétaire

## MODULE : COMMANDES

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| orders.create (prendre une commande) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| orders.view_all (voir toutes les commandes) | ✅ | ✅ | ✅ | ❌ (ses commandes seulement) | ❌ (section bar) | ❌ (section cuisine) | ❌ | ❌ | ✅ | ❌ |
| orders.assign_section (attribuer à un exécutant) | ✅ | ✅ | ✅ | ❌ | ✅ (bar) | ✅ (cuisine) | ❌ | ❌ | ❌ | ❌ |
| orders.mark_ready (marquer prêt) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| orders.transfer_table | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| orders.cancel (demande d'annulation) | ✅ | ✅ | ✅ | ✅ (demande) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| orders.approve_cancel (valider l'annulation) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| orders.qr_menu_manage (config commande QR) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## MODULE : TABLES

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| tables.configure_plan (plan de salle) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| tables.update_status | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| tables.reserve | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| tables.merge_split | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## MODULE : PAIEMENTS & FACTURATION CLIENT

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| payments.take_cash | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| payments.take_card_mobile | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| payments.split_bill | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| payments.refund_approve | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| invoices.view | ✅ | ✅ | ✅ | ✅ (les siennes) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

## MODULE : STOCKS & APPROVISIONNEMENTS

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| products.manage (créer/modifier produits) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| products.set_thresholds (seuils alerte/sécurité) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| stock.view | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| stock.record_movement (perte/casse) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| purchase_order.create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| purchase_order.validate | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| purchase_order.receive (réception marchandise) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| suppliers.manage | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| inventory.perform (saisir inventaire physique) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| inventory.view_discrepancy_report | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |

## MODULE : PERSONNEL & PRÉSENCES

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| employees.create (compte employé) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| employees.validate_signup | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| employees.manage_permissions | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| employees.view_files (contrat, pièce d'identité) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ⚙️ |
| schedules.manage (plannings) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| attendance.view_own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| attendance.view_all | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| attendance.grant_exception (retard/absence) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| leaves.request | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| leaves.approve | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## MODULE : PAIE

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| payroll.prepare | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| payroll.validate | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| payroll.view_own_payslip | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| payroll.view_all | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| payroll.configure_bonus_rules | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## MODULE : TRÉSORERIE & COMPTABILITÉ

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| treasury.view_consolidated | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| treasury.withdraw_funds | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| accounting.manage_expenses | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| accounting.export_reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| accounting.bank_reconciliation | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

## MODULE : RAPPORTS / KPI

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| reports.view_global_kpi | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| reports.view_own_performance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| reports.view_financial | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| reports.view_stock_kpi | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| reports.export | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |

## MODULE : COMMUNICATION

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| messages.send_group | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚙️ |
| messages.send_individual | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| messages.view_history | ✅ | ✅ | ✅ | ✅ (les siens) | ✅ (les siens) | ✅ (les siens) | ✅ (les siens) | ✅ (les siens) | ✅ (les siens) | ✅ (les siens) |

## MODULE : CONFIGURATION & ABONNEMENT

| Permission (code) | PRO | ADM | GER | SER | BAR | CUI | MAG | APP | COM | SEC |
|---|---|---|---|---|---|---|---|---|---|---|
| company.edit_settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| company.manage_categories_types_units | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| subscription.view | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| subscription.change_plan_pay | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| roles.create_custom_profile | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| audit_log.view | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## PERMISSIONS SPÉCIFIQUES — ESPACE SUPER-ADMIN (équipe DebitManager)

Ces droits sont gérés séparément de la matrice ci-dessus (rôles internes équipe DebitManager, distincts des rôles de boutique) :

- `platform.view_all_tenants`
- `platform.suspend_reactivate_tenant`
- `platform.view_all_transactions`
- `platform.manage_refunds`
- `platform.configure_pricing`
- `platform.configure_affiliate_program`
- `platform.validate_affiliate`
- `platform.process_affiliate_payout`
- `platform.manage_internal_accounts`
- `platform.view_global_audit_log`
- `platform.manage_support_tickets`

## PERMISSIONS SPÉCIFIQUES — ESPACE AFFILIÉ

- `affiliate.view_own_dashboard`
- `affiliate.view_referral_link`
- `affiliate.view_commissions`
- `affiliate.request_payout`

L'affilié n'a accès à aucune donnée d'une boutique au-delà de son statut d'abonnement global et du montant de commission généré.

## RÈGLES D'IMPLÉMENTATION

- Chaque permission listée est un `Permission.code` unique en base (voir [modele-donnees.md](data-model.md), section 5)
- Les valeurs ✅/❌ ci-dessus sont les **préréglages par défaut** appliqués à la création d'une boutique ; le Promoteur/Administrateur peut ensuite tout modifier depuis son dashboard, à l'exception des droits non désactivables du Promoteur (`treasury.withdraw_funds`, `subscription.change_plan_pay`)
- Un profil personnalisé créé par le Promoteur démarre avec toutes les permissions à ❌ et doit être configuré explicitement
- Toute action liée à une permission marquée comme sensible dans le cahier des charges technique (section 12) doit générer une entrée dans `AuditLog`, indépendamment du profil qui l'exécute

---

*Cette matrice est la source de vérité pour l'implémentation du contrôle d'accès. Toute permission non listée ici découverte en cours de développement doit être ajoutée à ce document avant d'être codée.*
