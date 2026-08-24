# Lot opérationnel DebitManager

## Cadrage

- [ ] Comparer les contrats API existants avec les besoins des maquettes prise de commande, tables et paiement.
- [ ] Vérifier les permissions serveur requises pour chaque action et chaque rôle.
- [ ] Définir les états chargement, vide, erreur, succès et absence de tenant.

## Prise de commande et paiement

- [ ] Construire l’écran Orders responsive avec catégories, produits, table active et panier.
- [ ] Rebrancher la sélection de produits sur les données tenant réelles.
- [ ] Construire l’écran de paiement avec montant reçu, rendu et choix Moneroo.
- [ ] Vérifier l’idempotence et les erreurs de création de commande.

## Plan de salle

- [ ] Construire les tables avec statuts libre, occupée et réservée.
- [ ] Ajouter une navigation claire vers la commande d’une table.
- [ ] Conserver l’isolation tenant et vérifier l’autorisation de modification.

## Validation

- [ ] Tester desktop et mobile sur les routes principales.
- [ ] Exécuter TypeScript, build production et tests disponibles.
- [ ] Vérifier les liens internes, états d’erreur et absence de données fictives.
- [ ] Préparer un commit et une pull request séparés pour revue GitOps.
