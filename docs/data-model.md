# Modèle de données détaillé — DebitManager

**Objectif du document :** figer une structure de base de données unique et non ambiguë, pour que tous les agents de développement (backend, mobile, web) travaillent sur le même schéma, sans réinterprétation.

## Conventions générales

- Toutes les tables ont un identifiant primaire `id` de type `UUID`, généré côté serveur
- Toutes les tables ont `created_at` et `updated_at` (timestamps, UTC)
- Toute table rattachée à une boutique porte une colonne `tenant_id` (FK vers `company.id`), indexée, et **toute requête doit filtrer systématiquement par** `tenant_id` (isolation multi-tenant)
- Les suppressions sont des **soft delete** (`deleted_at` nullable) sauf mention contraire, pour préserver l'historique et l'audit
- Les montants sont stockés en entier (plus petite unité monétaire, ex. XOF sans décimale) pour éviter les erreurs d'arrondi
- Les enums sont listés en majuscules ; les agents doivent les implémenter comme types enum natifs (PostgreSQL `ENUM` ou équivalent applicatif strictement validé)

## Sommaire

1. Company (Entreprise/Boutique)
2. Subscription (Abonnement)
3. PlatformConfig (Configuration globale plateforme)
4. User (Utilisateur)
5. Role / Permission
6. Employee (Employé)
7. Schedule (Planning)
8. Attendance (Présence)
9. Category / ProductType / Unit
10. Product (Produit)
11. StockMovement / Inventory
12. Supplier (Fournisseur)
13. PurchaseOrder / PurchaseOrderItem
14. Table (Table de salle)
15. Order / OrderItem
16. Invoice (Facture)
17. Payment (Paiement)
18. Payroll (Paie)
19. TreasuryMovement (Mouvement de trésorerie)
20. Notification / Message
21. AuditLog (Journal d'audit)
22. Affiliate (Affilié)
23. ReferralTracking (Suivi de parrainage)
24. AffiliateCommission
25. AffiliatePayout
26. SupportTicket
27. Diagramme relationnel (résumé textuel)

---

## 1. COMPANY (Entreprise/Boutique)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| name | string(150) | requis |
| activity_type | ENUM(`BUVETTE`, `BAR_RESTAURANT`, `NIGHTCLUB_LOUNGE`) | requis, détermine le coefficient tarifaire |
| unique_code | string(10) | unique, généré automatiquement, utilisé par les employés pour rejoindre |
| country | string(2) | code ISO pays |
| currency | string(3) | code ISO devise, défaut `XOF` |
| language | string(5) | code langue (ex. `fr`, `en`) |
| logo_url | string | nullable |
| address | string(255) | nullable |
| status | ENUM(`TRIAL`, `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED`, `EXPIRED`, `CANCELLED`) | requis |
| trial_ends_at | timestamp | nullable |
| owner_user_id | UUID | FK → User.id |
| affiliate_id | UUID | FK → Affiliate.id, nullable, renseigné si la boutique a été apportée par un affilié |
| referral_tracking_id | UUID | FK → ReferralTracking.id, nullable |
| created_at / updated_at / deleted_at | timestamp | |

**Relations :** 1 Company → N User, N Employee, N Product, N Table, N Subscription (historique), N Order, N PurchaseOrder, N Payroll.

## 2. SUBSCRIPTION (Abonnement)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| plan | ENUM(`BASE`, `MOYENNE`, `SEMESTRIELLE`, `SUPREME`) | correspond aux périodes 1/3/6/12 mois |
| activity_coefficient | DECIMAL(3,2) | 1.0 / 1.5 / 2.0, dérivé de `activity_type` au moment de la souscription |
| amount | INTEGER | montant payé, plus petite unité monétaire |
| currency | string(3) | |
| period_start | timestamp | |
| period_end | timestamp | |
| status | ENUM(`PENDING`, `ACTIVE`, `EXPIRED`, `GRACE_PERIOD`, `SUSPENDED`, `CANCELLED`) | |
| payment_id | UUID | FK → Payment.id, nullable tant que non payé |
| auto_renew | boolean | défaut `false` |
| created_at / updated_at | timestamp | |

**Relations :** N Subscription → 1 Company. 1 Subscription → 1 Payment (paiement de l'abonnement). 1 Subscription → 0..1 AffiliateCommission (si boutique parrainée).

## 3. PLATFORMCONFIG (Configuration globale plateforme — Super-Admin)

Table à ligne unique ou clé/valeur, gérée exclusivement par le Super-Admin.

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| key | string(100) | unique (ex. `pricing.base.monthly`, `affiliate.commission_rate`) |
| value | JSON | valeur structurée |
| updated_by_user_id | UUID | FK → User.id (Super-Admin) |
| updated_at | timestamp | |

**Clés attendues (liste non exhaustive) :** grille tarifaire complète (12 tarifs), taux de commission plateforme (1%), taux de commission d'affiliation, mode de commission d'affiliation (`FIRST_PAYMENT` / `RECURRING`), seuil minimum de retrait affilié, durée de vie du tracking de parrainage, durée de la période d'essai, durée de la période de grâce.

## 4. USER (Utilisateur)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id, **nullable** (null pour Super-Admin et Affilié, non rattachés à une boutique) |
| first_name / last_name | string(80) | |
| phone | string(20) | unique, requis |
| email | string(150) | unique, nullable |
| password_hash | string | requis (bcrypt/argon2) |
| user_type | ENUM(`TENANT_STAFF`, `SUPER_ADMIN`, `AFFILIATE`) | détermine l'espace applicatif accessible |
| role_id | UUID | FK → Role.id, nullable si `user_type` ≠ `TENANT_STAFF` |
| status | ENUM(`PENDING_VALIDATION`, `ACTIVE`, `SUSPENDED`, `DELETED`) | |
| two_factor_enabled | boolean | obligatoire à `true` pour rôles sensibles et Super-Admin |
| last_login_at | timestamp | nullable |
| last_login_ip | string | nullable |
| created_at / updated_at / deleted_at | timestamp | |

**Relations :** 1 User → 0..1 Employee (si staff opérationnel). 1 User → 0..1 Affiliate (si `user_type = AFFILIATE`). 1 User (owner) → 1 Company.

## 5. ROLE / PERMISSION

### Role

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id, nullable (les 11 rôles prédéfinis sont des gabarits globaux, dupliqués/personnalisables par boutique) |
| name | string(80) | ex. `Serveur`, `Comptable`, ou nom personnalisé |
| is_predefined | boolean | `true` pour les 11 profils système |
| created_at / updated_at | timestamp | |

### Permission

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| code | string(100) | unique, ex. `orders.create`, `payroll.validate` (voir matrice-permissions.md) |
| module | string(50) | ex. `Commandes`, `Stocks`, `Personnel`, `Paie`, `Trésorerie`, `Comptabilité`, `Rapports`, `Configuration` |
| description | string(255) | |

### RolePermission (table de jonction)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| role_id | UUID | FK → Role.id |
| permission_id | UUID | FK → Permission.id |
| granted | boolean | activable/désactivable indépendamment |

## 6. EMPLOYEE (Employé)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| user_id | UUID | FK → User.id |
| position | string(80) | intitulé de poste |
| hourly_rate / monthly_salary | INTEGER | nullable selon mode de rémunération |
| payment_method | ENUM(`MOBILE_MONEY`, `BANK_TRANSFER`, `CASH`) | |
| payment_account_ref | string(100) | numéro mobile money / IBAN, **chiffré au repos** |
| id_document_url | string | nullable, stockage sécurisé |
| contract_document_url | string | nullable |
| status | ENUM(`ACTIVE`, `ON_LEAVE`, `TERMINATED`) | |
| created_at / updated_at / deleted_at | timestamp | |

**Relations :** 1 Employee → N Schedule, N Attendance, N Payroll.

## 7. SCHEDULE (Planning)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| employee_id | UUID | FK → Employee.id |
| day_of_week | ENUM(`MON`..`SUN`) | |
| start_time / end_time | TIME | |
| exception_date | DATE | nullable, remplace le planning standard pour une date donnée |
| created_at / updated_at | timestamp | |

## 8. ATTENDANCE (Présence)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| employee_id | UUID | FK → Employee.id |
| tenant_id | UUID | FK → Company.id |
| check_in_at | timestamp | |
| check_in_lat / check_in_lng | DECIMAL(9,6) | |
| status | ENUM(`ON_TIME`, `LATE`, `ABSENT`, `EXCEPTION`) | |
| exception_reason | string(255) | nullable |
| exception_granted_by_user_id | UUID | FK → User.id, nullable |
| check_out_at | timestamp | nullable |
| created_at | timestamp | |

## 9. CATEGORY / PRODUCTTYPE / UNIT

Tables de référence, préconfigurées globalement et extensibles par boutique (`tenant_id` nullable = valeur globale par défaut, sinon spécifique à la boutique).

| Table | Champs principaux |
|---|---|
| Category | id, tenant_id (nullable), name (ex. bières, sucreries, énergisantes, spiritueux, repas) |
| ProductType | id, tenant_id (nullable), name (ex. 33cl, champagnes, petit-déjeuner, poissons…) |
| Unit | id, tenant_id (nullable), name (ex. bouteille, plat, conso, dose, tasse, unité) |

## 10. PRODUCT (Produit)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| name | string(120) | |
| category_id | UUID | FK → Category.id |
| type_id | UUID | FK → ProductType.id |
| unit_id | UUID | FK → Unit.id |
| price | INTEGER | prix courant |
| image_url | string | nullable |
| current_stock | INTEGER | |
| alert_threshold | INTEGER | |
| safety_threshold | INTEGER | |
| created_at / updated_at / deleted_at | timestamp | |

**PriceHistory** (table associée) : id, product_id (FK), old_price, new_price, changed_by_user_id, changed_at.

## 11. STOCKMOVEMENT / INVENTORY

### StockMovement

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| product_id | UUID | FK → Product.id |
| movement_type | ENUM(`IN_PURCHASE`, `OUT_SALE`, `OUT_LOSS`, `OUT_BREAKAGE`, `OUT_EXPIRY`, `ADJUSTMENT`) | |
| quantity | INTEGER | positif ou négatif selon type |
| reason | string(255) | nullable, obligatoire pour pertes/casse |
| responsible_user_id | UUID | FK → User.id, nullable |
| reference_id | UUID | nullable, FK polymorphique vers Order/PurchaseOrder/Inventory |
| created_at | timestamp | |

### Inventory (inventaire physique)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| performed_at | timestamp | |
| performed_by_user_id | UUID | FK → User.id |
| status | ENUM(`IN_PROGRESS`, `COMPLETED`) | |

### InventoryLine

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| inventory_id | UUID | FK → Inventory.id |
| product_id | UUID | FK → Product.id |
| theoretical_quantity | INTEGER | calculée par le système |
| actual_quantity | INTEGER | saisie manuelle |
| discrepancy | INTEGER | calculé = actual - theoretical |
| interpretation | ENUM(`OK`, `PROBABLE_LOSS`, `PROBABLE_THEFT`, `INPUT_ERROR`) | généré par le système selon règles configurables |

## 12. SUPPLIER (Fournisseur)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| name | string(120) | |
| phone / email | string | |
| average_delivery_days | INTEGER | nullable, calculé sur historique |
| created_at / updated_at / deleted_at | timestamp | |

## 13. PURCHASEORDER / PURCHASEORDERITEM

### PurchaseOrder

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| supplier_id | UUID | FK → Supplier.id |
| created_by_user_id | UUID | FK → User.id (chargé des approvisionnements) |
| status | ENUM(`DRAFT`, `PENDING_VALIDATION`, `VALIDATED`, `SENT`, `RECEIVED`, `CANCELLED`) | |
| validated_by_user_id | UUID | FK → User.id, nullable |
| created_at / updated_at | timestamp | |

### PurchaseOrderItem

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| purchase_order_id | UUID | FK → PurchaseOrder.id |
| product_id | UUID | FK → Product.id |
| quantity_ordered | INTEGER | |
| quantity_received | INTEGER | nullable |
| unit_price | INTEGER | |

## 14. TABLE (Table de salle)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| number | string(10) | |
| zone | string(50) | nullable |
| capacity | INTEGER | |
| status | ENUM(`FREE`, `OCCUPIED`, `RESERVED`, `TO_CLEAN`) | |
| qr_order_enabled | boolean | activable par boutique |
| created_at / updated_at | timestamp | |

**Reservation** (table associée) : id, table_id (FK), customer_name, customer_phone, reserved_at, party_size, status.

## 15. ORDER / ORDERITEM

### Order

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| table_id | UUID | FK → Table.id, nullable (commande à emporter) |
| server_user_id | UUID | FK → User.id |
| status | ENUM(`PENDING`, `IN_PREPARATION`, `READY`, `DELIVERED`, `PAID`, `CANCELLED`) | |
| source | ENUM(`SERVER`, `QR_CLIENT`) | |
| offline_created | boolean | `true` si créée hors-ligne, pour traçabilité de synchronisation |
| client_generated_id | UUID | identifiant généré côté mobile pour dédupliquer lors de la synchronisation |
| cancelled_reason | string(255) | nullable |
| cancelled_by_user_id | UUID | FK → User.id, nullable |
| created_at / updated_at | timestamp | |

### OrderItem

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → Order.id |
| product_id | UUID | FK → Product.id |
| quantity | INTEGER | |
| unit_price | INTEGER | prix au moment de la commande (figé) |
| section | ENUM(`BAR`, `KITCHEN`) | dérivé de la catégorie produit |
| assigned_to_user_id | UUID | FK → User.id (barman/cuisinier), nullable |
| status | ENUM(`PENDING`, `IN_PREPARATION`, `READY`) | |

## 16. INVOICE (Facture)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| order_id | UUID | FK → Order.id |
| legal_sequential_number | string(30) | unique par tenant, séquentiel, conforme fiscalité locale |
| total_amount | INTEGER | |
| tax_amount | INTEGER | |
| tip_amount | INTEGER | défaut 0 |
| pdf_url | string | |
| status | ENUM(`ISSUED`, `PAID`, `CANCELLED`, `REFUNDED`) | |
| created_at | timestamp | |

## 17. PAYMENT (Paiement)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id, nullable pour un paiement d'abonnement avant activation |
| payment_purpose | ENUM(`ORDER`, `SUBSCRIPTION`, `PAYROLL`) | |
| reference_id | UUID | FK polymorphique (Invoice.id / Subscription.id / Payroll.id) |
| amount | INTEGER | |
| method | ENUM(`CASH`, `CARD`, `MOBILE_MONEY`) | |
| aggregator | ENUM(`KKIAPAY`, `MONEROO`, `CINETPAY`, `NONE`) | `NONE` pour espèces |
| aggregator_reference | string(100) | nullable |
| platform_commission_amount | INTEGER | 1% du montant, uniquement pour paiements clients carte/mobile money |
| status | ENUM(`PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`) | |
| webhook_received_at | timestamp | nullable |
| reconciled | boolean | défaut `false`, mis à `true` après rapprochement quotidien |
| created_at / updated_at | timestamp | |

## 18. PAYROLL (Paie)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| employee_id | UUID | FK → Employee.id |
| period_month | INTEGER | 1-12 |
| period_year | INTEGER | |
| base_amount | INTEGER | |
| bonus_amount | INTEGER | défaut 0 |
| deduction_amount | INTEGER | défaut 0 |
| total_amount | INTEGER | calculé |
| status | ENUM(`DRAFT`, `PENDING_VALIDATION`, `VALIDATED`, `PAID`) | |
| validated_by_user_id | UUID | FK → User.id, nullable |
| payment_id | UUID | FK → Payment.id, nullable |
| payslip_pdf_url | string | nullable |
| created_at / updated_at | timestamp | |

## 19. TREASURYMOVEMENT (Mouvement de trésorerie)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id |
| movement_type | ENUM(`SALE_INCOME`, `WITHDRAWAL`, `EXPENSE`, `PAYROLL_OUTFLOW`, `SUPPLIER_PAYMENT`) | |
| payment_method | ENUM(`CASH`, `CARD`, `MOBILE_MONEY`) | |
| amount | INTEGER | |
| reference_id | UUID | nullable, FK polymorphique |
| created_at | timestamp | |

## 20. NOTIFICATION / MESSAGE

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id, nullable (notifications plateforme globales) |
| sender_user_id | UUID | FK → User.id, nullable (système) |
| recipient_user_id | UUID | FK → User.id, nullable si envoi groupe |
| recipient_group_role_id | UUID | FK → Role.id, nullable |
| channel | ENUM(`PUSH`, `SMS`, `EMAIL`) | |
| event_type | string(50) | ex. `ORDER_READY`, `STOCK_ALERT`, `SUBSCRIPTION_EXPIRING`, `AFFILIATE_NEW_REFERRAL` |
| content | text | requis |
| requires_response | boolean | défaut `false` |
| read_at | timestamp | nullable |
| created_at | timestamp | |

## 21. AUDITLOG (Journal d'audit)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id, nullable pour actions Super-Admin globales |
| user_id | UUID | FK → User.id |
| action | string(100) | ex. `PRICE_UPDATED`, `PAYROLL_VALIDATED`, `ACCOUNT_DELETED`, `FUNDS_WITHDRAWN`, `TENANT_SUSPENDED` |
| entity_type | string(50) | |
| entity_id | UUID | |
| ip_address | string(45) | |
| metadata | JSON | détail avant/après pour les actions sensibles |
| created_at | timestamp | **immuable, non modifiable après écriture** |

## 22. AFFILIATE (Affilié)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → User.id (`user_type = AFFILIATE`) |
| referral_code | string(20) | unique, généré automatiquement |
| referral_link | string(255) | unique |
| payment_method | ENUM(`MOBILE_MONEY`, `BANK_TRANSFER`) | |
| payment_account_ref | string(100) | chiffré au repos |
| status | ENUM(`PENDING_VALIDATION`, `ACTIVE`, `SUSPENDED`, `REJECTED`) | |
| commission_rate_override | DECIMAL(5,2) | nullable, surcharge du taux global si autorisé |
| commission_mode_override | ENUM(`FIRST_PAYMENT`, `RECURRING`) | nullable |
| created_at / updated_at | timestamp | |

## 23. REFERRALTRACKING (Suivi de parrainage)

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| affiliate_id | UUID | FK → Affiliate.id |
| tracking_token | string(64) | identifiant unique du clic |
| clicked_at | timestamp | |
| source | string(100) | nullable (UTM/canal) |
| converted_company_id | UUID | FK → Company.id, nullable jusqu'à inscription effective |
| converted_at | timestamp | nullable |
| expires_at | timestamp | calculé selon durée de vie de tracking configurée |

## 24. AFFILIATECOMMISSION

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| affiliate_id | UUID | FK → Affiliate.id |
| company_id | UUID | FK → Company.id (boutique parrainée) |
| subscription_id | UUID | FK → Subscription.id |
| amount | INTEGER | |
| status | ENUM(`PENDING`, `VALIDATED`, `PAID`, `REJECTED`) | |
| validated_at | timestamp | nullable, après délai de sécurité anti-remboursement |
| created_at | timestamp | |

## 25. AFFILIATEPAYOUT

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| affiliate_id | UUID | FK → Affiliate.id |
| amount | INTEGER | |
| period_start / period_end | timestamp | nullable si versement à la demande |
| status | ENUM(`REQUESTED`, `PROCESSING`, `PAID`, `REJECTED`) | |
| payment_reference | string(100) | nullable |
| processed_by_user_id | UUID | FK → User.id (Super-Admin), nullable |
| created_at / updated_at | timestamp | |

## 26. SUPPORTTICKET

| Champ | Type | Contraintes / Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → Company.id, nullable si ticket affilié |
| affiliate_id | UUID | FK → Affiliate.id, nullable |
| created_by_user_id | UUID | FK → User.id |
| subject | string(150) | |
| status | ENUM(`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`) | |
| assigned_to_user_id | UUID | FK → User.id (équipe support), nullable |
| created_at / updated_at | timestamp | |

**TicketMessage** (table associée) : id, ticket_id (FK), author_user_id (FK), content, created_at.

## 27. Diagramme relationnel (résumé textuel)

```
Company 1---N Subscription
Company 1---N User
Company 1---N Employee
Company 1---N Product ---N Category/ProductType/Unit
Company 1---N Table 1---N Order 1---N OrderItem ---1 Product
Order 1---1 Invoice 1---N Payment
Employee 1---N Schedule
Employee 1---N Attendance
Employee 1---N Payroll ---1 Payment
Company 1---N Supplier 1---N PurchaseOrder 1---N PurchaseOrderItem ---1 Product
Company 1---N TreasuryMovement
Company 1---N AuditLog
Affiliate 1---N ReferralTracking ---0..1 Company (conversion)
Affiliate 1---N AffiliateCommission ---1 Subscription
Affiliate 1---N AffiliatePayout
User 1---0..1 Employee
User 1---0..1 Affiliate
Role 1---N RolePermission ---N Permission
```

---

*Ce document fait foi comme structure de base de données unique. Toute évolution de schéma en cours de développement doit être documentée ici avant implémentation, pour rester la source de vérité pour tous les agents.*
