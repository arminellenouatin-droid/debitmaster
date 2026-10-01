# Mémo — Boutique & Commerce, Sprint 3 Stock

**Date** : 2026-10-01
**Objectif** : Livrer le stock Commerce par magasin, ses mouvements, alertes et réservations sans modifier les activités legacy.

## Périmètre
Le lot couvre les soldes physiques/réservés/disponibles par produit et magasin, les mouvements audités append-only, les alertes de rupture/minimum/surstock, les réservations avec expiration, les API sécurisées et l’écran Stock. Les ventes/factures, la caisse, les livraisons de vente, les achats/réceptions, les transferts inter-magasins complets et les inventaires restent dans les sprints ultérieurs du PRD.

## Décisions et sécurité
Le module réutilise `commerce_stores`, `commerce_employee_stores`, les permissions Commerce et les seuils catalogue `min_stock` / `reorder_point`. Le stock négatif est interdit par défaut; seul le promoteur peut activer explicitement cette option. La réservation expire après 24 h par défaut, durée réglable par établissement; les quantités expirées ne réduisent jamais le disponible. Les GET sont sans effet de bord; statut d’expiration et audit sont matérialisés lors d’une mutation Stock, tandis que lectures et vues excluent immédiatement les réservations expirées.

Les mouvements sont atomiques, verrouillés par solde, immuables et idempotents sur le payload métier complet. Les changements de politique de stock sont sérialisés avec les opérations correspondantes. Un utilisateur doté de `sales.create` peut créer une réservation seulement dans un magasin qui lui est affecté, pour préparer l’intégration aux factures du Sprint 4; les mouvements, réglages et libérations manuelles restent protégés par leurs permissions Stock. Aucune table legacy n’est modifiée; l’accès direct aux tables stock est refusé à `anon` et `authenticated`, les écritures passent par des fonctions contrôlées et le journal Commerce reste immuable.

## Revue et validation locale
La revue manuelle finale a corrigé la remontée des erreurs de lecture API, les filtres d’état invalides, les produits archivés dans les actions incompatibles et le verrou de durée de réservation. L’installation figée `pnpm install --frozen-lockfile`, le typecheck, le parsing PostgreSQL, le build Next production et `git diff --check` passent. Les tests réussissent à 8/8, dont l’intégration PostgreSQL éphémère PGlite sur l’isolation tenant/magasin, les permissions vendeur, les réservations, l’expiration, l’idempotence, l’audit et l’immutabilité. `pnpm audit` ne détecte aucun avis connu. Le lint complet ne renvoie aucune erreur; il reste 112 avertissements dans le dépôt, et le lint ciblé du nouveau module Stock passe.

Next.js et `eslint-config-next` ont été mis à jour de 16.3.4 à 16.3.8 à la suite de l’avis critique GHSA-vcvr-r3jv-pc5j / CVE-2026-94545 concernant `next/og` ImageResponse. La release 16.3.8 est celle de la release officielle de sécurité du 30 septembre. Le bulletin Next.js indique que deux vulnérabilités coordonnées supplémentaires (une critique et une élevée) restent en attente d’une release ultérieure; l’audit courant est propre, mais ce point doit être surveillé.

## État de livraison
Branche : `feat/boutique-commerce-sprint-3-stock-20261001`. Les routes `/dashboard/commerce/stock` et `/api/commerce/stock/*` sont incluses dans le build. La PR et son preview sont à ouvrir/valider après la revue finale GitHub. **Aucune fusion et aucune migration Supabase Sprint 3 en production** n’ont été faites; ces actions attendront les checks CI/preview et une confirmation explicite.
