# Mémo — QR des tables et des chambres

**Objectif :** afficher sous les tables les chambres d’hôtel actives, leurs photos et leurs QR de commande, en réutilisant le modèle d’affiche QR.

## Périmètre
- Inclus : liste distincte des chambres actives sous les tables, photos enregistrées, affiche QR par chambre, et résolution sécurisée du QR pour les commandes.
- Hors périmètre : migration Supabase, changement de version/algorithme/secret des jetons, nouvelles fonctions de catalogue ou refonte du parcours QR des tables.

## Contexte et décisions
- L’ancienne liste de chambres existe seulement sur une branche non intégrée; la page principale ne charge que `dining_tables`.
- `power_lodging_rooms.image_url` et son upload existent déjà; 4 chambres actives sont présentes pour LE TEMPLE DU PLAISIR, 2 avec photo.
- Émettre un token v1 signé portant exactement `tableId` ou `roomId`; vérifier tenant et statut actif avant d’afficher le menu ou d’accepter le paiement.
- Présenter l’emplacement comme « Chambre N / Auberge » dans le menu et dans les commandes; aucun changement de colonnes.
- La table `orders` ne possède pas de `room_id`; garder `table_label = Chambre N` et `location_label = Auberge`, puis vérifier ces deux champs avec le QR signé au paiement.
- Direction visuelle : cartes chambres cohérentes avec le vert du tableau de bord, photo avec dimensions réservées, QR imprimable au même format que les tables.

## Design / UX
- Lecture : affiche imprimable mobile/desktop pour un client qui scanne à sa table; reprendre le modèle historique plutôt que créer une nouvelle identité.
- Dials : variance 2/10, mouvement 1/10, densité 4/10; priorité à un QR assez grand et aux libellés table/zone immédiatement lisibles.

## Plan et validation
- [x] Ouvrir la PR dédiée #101 pour les affiches QR des tables.
- [x] Restaurer la résolution QR des chambres et les libellés côté menu/paiement, sans changer la version v1.
- [x] Afficher les chambres actives sous les tables, avec photo ou état sans photo et affiche QR.
- [x] Vérifier les tests, lint, typecheck, build et diff-check en local.
- [ ] Pousser sur la PR #101 existante et attendre ses checks actualisés, sans fusionner ni déployer.

## État final livré
- PR #101 reste ouverte : https://github.com/arminellenouatin-droid/debitmaster/pull/101; son scope est étendu aux chambres de la même page.
- Données confirmées en lecture seule : 4 chambres actives, 2 photos enregistrées; aucune écriture Supabase prévue.
- Validations locales : lint passe (0 erreur, 245 avertissements préexistants au niveau dépôt), typecheck passe, 128/128 tests passent, build et `git diff --check` passent.
- État : changements prêts à pousser sur la branche de la PR; les checks GitHub/Vercel seront relancés à son prochain commit.
- Aucun merge ni déploiement production sans demande explicite.
