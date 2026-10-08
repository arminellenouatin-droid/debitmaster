# Mémo — Rétablissement de l’affiche QR par table

**Objectif :** remettre le modèle d’affiche QR historique sur chaque table, avec établissement, code au centre, table et zone.

## Périmètre
- Inclus : réutiliser le style historique du poster dans le plan de salle et l’associer au QR signé de chaque table.
- Exclu : modifier le menu client, les jetons publics, la base Supabase ou le flux de commande.

## Contexte et décisions
- Écran actuel : `TablesClient.tsx` télécharge seulement une image QR.
- Le modèle existe dans l’historique Git (`47df63a` / variante `2bdfc4b`), mais il n’est pas présent sur `main`.
- Réutiliser `public_menu_url` fourni par l’API, qui est déjà lié à l’établissement et à la table; garder le contrôle d’accès existant au bouton.
- Direction visuelle reprise du modèle : fond vert profond, cadre doré, nom en tête, QR dominant au centre, table et zone en dessous.
- Aucun changement de schéma, de token, de route publique, de permissions ou de données.

## Design / UX
- Lecture : affiche imprimable mobile/desktop pour un client qui scanne à sa table; reprendre le modèle historique plutôt que créer une nouvelle identité.
- Dials : variance 2/10, mouvement 1/10, densité 4/10; priorité à un QR assez grand et aux libellés table/zone immédiatement lisibles.

## Plan et validation
- [x] Rebrancher la prévisualisation et les actions impression/téléchargement par table.
- [x] Prévoir le responsive mobile/tablette/desktop, le dialogue natif clavier et l’échappement des libellés dans l’impression.
- [x] Lancer lint ciblé, typecheck, tests et build.
- [ ] Créer une PR dédiée, sans fusionner ni déployer sans autorisation.

## État final livré
- Implémentation locale prête : affiche par table, avec impression et PNG; aucun changement de base ni de jeton.
- Validations : lint réussi (0 erreur, 246 avertissements repo-wide), TypeScript réussi, 125/125 tests, build réussi et `git diff --check` réussi.
- Vérification visuelle responsive effectuée à 375×667, 375×850, 768×1024 et 1440×1000; le QR, la table, la zone et les actions restent lisibles, y compris sur petit écran.
- Reste à faire : pousser la branche et ouvrir la PR; production non modifiée.
