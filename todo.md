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

## Lot de finalisation en cours

- [x] Vérifier le schéma et les contraintes disponibles pour les tables de salle et les statuts de commande.
- [x] Ajouter une table persistante de salle avec tenant_id, libellé, zone et statut.
- [x] Ajouter les routes sécurisées de lecture, création et mise à jour des tables.
- [x] Ajouter la mise à jour de statut des commandes KDS avec orders.prepare et orders.deliver.
- [x] Brancher les actions du KDS sur les routes de statut et gérer les erreurs de permission.
- [x] Vérifier la migration de messagerie et préparer un contrôle d’application Supabase.
- [x] Préparer le contrat Moneroo, le retour de paiement et le webhook sans simuler de succès.
- [x] Exécuter les tests TypeScript, build, sécurité tenant et responsive avant livraison.

## Lot validation et durcissement

- [ ] Vérifier la présence des variables serveur Moneroo et l’URL publique de retour sans exposer de secrets.
- [ ] Tester le refus propre de Moneroo lorsque la configuration serveur est absente.
- [ ] Vérifier le parcours commande créée → paiement → retour Moneroo.
- [ ] Tester les transitions KDS valides et les transitions hors séquence.
- [ ] Tester l’isolation entre deux tenants et les réponses 401/403.
- [ ] Revoir les alertes Supabase Auth et la fonction SECURITY DEFINER d’invitation.
- [ ] Vérifier le rendu mobile des routes métier et les états vides/erreurs.
- [ ] Préparer un rapport de validation et un commit séparé si des corrections sont nécessaires.
