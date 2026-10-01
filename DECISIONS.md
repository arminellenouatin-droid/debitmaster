# Décisions produit — Boutique & Commerce

## Sprint 3 — Stocks

- Le stock est isolé de toutes les activités historiques et rattaché à un établissement Commerce et à un magasin Commerce.
- Les affectations de magasins existantes définissent la portée des comptes équipe; le promoteur conserve la portée globale de son établissement.
- Les seuils catalogue `min_stock` et `reorder_point` s’appliquent à chaque magasin pour la V1; le réglage par magasin reste une évolution possible.
- Le stock négatif est désactivé par défaut et ne peut être activé que par un réglage explicite du promoteur.
- Une réservation expire après 24 heures par défaut; la durée est configurable par établissement.
- Les lectures GET sont sans effet de bord. L’expiration est matérialisée et auditée lors d’une mutation Stock; les réservations expirées ne réduisent jamais la quantité disponible et ne sont pas présentées comme actives.
- Le journal des mouvements est append-only. Toute correction est une écriture inverse auditable, jamais une modification ou suppression d’un mouvement.
- Les opérations de stock sont atomiques, idempotentes sur l’ensemble du payload et sérialisées par solde; les changements du réglage stock négatif prennent un verrou cohérent avec les mouvements.
- Un employé doté de `sales.create` peut créer une réservation uniquement pour un magasin qui lui est affecté, afin de permettre au Sprint 4 de réserver les lignes de facture. Les opérations de mouvement, réglage et libération manuelle restent soumises à leurs permissions Stock respectives.
- Les transferts inter-magasins complets, ventes, paiements, livraisons et approvisionnements sont reportés aux sprints correspondants du PRD.
- La présente branche ne fusionne pas et n’applique aucune migration en production sans nouvelle validation explicite.
