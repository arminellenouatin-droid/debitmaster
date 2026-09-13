# Gabarit — Mémo de mission

À copier/adapter au début de chaque mission non triviale, dans un fichier du projet (ex: `MEMO_<nom-mission>.md`), pour servir de mémoire externe et éviter de tout relire à chaque reprise du travail.

```markdown
# Mémo — <nom de la mission>

**Date** : <date>
**Objectif en une phrase** : <pourquoi cette mission existe>

## Périmètre
- Inclus : ...
- Hors périmètre : ...

## Contexte technique
- Stack / fichiers concernés : ...
- Conventions existantes à respecter : ...

## Décisions prises
- <décision> — parce que <raison>
- <décision> — parce que <raison>

## Points de sécurité identifiés
- ...

## Design / UX (si applicable)
- Direction visuelle retenue : ...
- Points de responsive à vérifier : ...

## Paiement (si applicable)
- Prestataire : Moneroo / MTN MoMo
- Environnement : sandbox / production
- Flux retenu : ...

## Plan d'exécution
- [ ] Étape 1
- [ ] Étape 2
- [ ] Étape 3

## État final livré (à remplir à la clôture)
- Ce qui a été fait : ...
- Ce qui reste / dette technique consciente : ...
```

## Pourquoi ce mémo est obligatoire (pas optionnel)
- Il évite de relire tout le code existant à chaque reprise d'une mission.
- Il rend explicite ce qui a été décidé et pourquoi, pour ne pas revenir dessus par erreur plus tard.
- Il donne un état des lieux fiable si une autre session ou un autre agent reprend le projet.
- Il force la clarification de la Phase 1 (compréhension de la mission) avant de coder, puisqu'il faut le remplir avant de commencer.
