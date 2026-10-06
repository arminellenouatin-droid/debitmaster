# Mémo — Déblocage des contrôles de la PR #100

**Date** : 2026-10-07
**Objectif en une phrase** : Corriger les blocages préexistants de lint et les dépendances vulnérables afin de finaliser la PR #100, sans élargir les changements produit au-delà de son périmètre approuvé.

## Périmètre
- Inclus : 88 erreurs ESLint du dépôt, deux avis de sécurité concernant `source-map-js` et `sharp`, validations CI, aperçu Vercel, puis fusion de la seule PR #100 si tous les contrôles passent.
- Hors périmètre : toute autre fonctionnalité, modification de données de production, PR autre que #100, ou contournement d’un contrôle.

## Contexte technique
- Next.js 16.3.8, TypeScript, pnpm 11.25.0.
- Branche de travail : `feat/catalog-product-service-images-20261006` (PR #100).
- Les diagnostics concernent des fichiers préexistants répartis dans scripts CommonJS, API Commerce/Couture/PawaPay et dashboards.

## Décisions prises
- Remplacer les `any` par des types de domaine ou `unknown` avec validation, afin de conserver les garanties de sécurité plutôt que supprimer la règle.
- Garder les scripts Node CommonJS en CommonJS et limiter l’exception ESLint à ces scripts.
- Forcer les versions corrigées `source-map-js >=1.2.2` et `sharp >=0.35.5`, sous réserve de compatibilité avec Next.js 16.3.8.
- Aucune fusion avant réussite des checks requis; ne pas ignorer les alertes ni utiliser de contournement de CI.

## Points de sécurité identifiés
- `source-map-js` <1.2.2 : blocage de boucle d’événements via offsets de source maps indexées (GHSA-68fv-2mgg-jv7q).
- `sharp` <0.35.5 : vulnérabilité haute de sa dépendance librsvg (GHSA-wq5f-xc86-pv6w).
- Les correctifs de types ne doivent pas affaiblir la validation des entrées, l’autorisation tenant ou les vérifications des webhooks PawaPay.

## Plan d’exécution
- [ ] Corriger les erreurs ESLint par domaines sans changer les règles métier.
- [ ] Mettre à niveau uniquement les dépendances vulnérables et le lockfile.
- [ ] Exécuter lint, tests, typecheck, audit et build localement.
- [ ] Pousser les correctifs sur la branche de la PR #100 et attendre CI/Vercel.
- [ ] Fusionner uniquement #100 si les contrôles sont tous au vert; mettre à jour cet état final.

## État final livré
- En cours; à compléter après validations GitHub et déploiement.

## Sources de sécurité consultées
- GitHub Advisory Database, GHSA-68fv-2mgg-jv7q / CVE-2026-93749 : `source-map-js` versions 1.0.0 à 1.2.1 affectées; version corrigée 1.2.2; avis vérifié le 2026-10-07 : https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- GitHub Advisory Database, GHSA-wq5f-xc86-pv6w : `sharp` versions <0.35.5 affectées par la dépendance librsvg; version corrigée 0.35.5; avis vérifié le 2026-10-07 : https://github.com/advisories/GHSA-wq5f-xc86-pv6w
- Après overrides pnpm et lockfile actualisé, `pnpm audit --prod` ne signale plus de vulnérabilité.
