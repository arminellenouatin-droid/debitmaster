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

## Nouveau lot — parcours établissement et équipe

- [ ] Supprimer du dashboard propriétaire les blocs d’onboarding après création d’un établissement.
- [ ] Afficher l’établissement sélectionné en contexte principal dans toutes les sections connectées.
- [ ] Construire les KPI et graphiques réels du dashboard propriétaire : chiffre d’affaires, performances agents et présence.
- [ ] Afficher le statut d’abonnement et les commandes tarifaires uniquement au propriétaire.
- [ ] Séparer clairement les dashboards et droits Serveur/Serveuse, Gérant et Chef cuisine.
- [ ] Ajouter la gestion des postes, rôles et affectations dans Personnel.
- [ ] Ajouter l’affectation des tables et emplacements aux serveurs.
- [ ] Réserver la création de produits et le paramétrage des prix aux rôles habilités.
- [ ] Préparer la connexion par e-mail ou téléphone.
- [ ] Concevoir la création de comptes équipe sans dépendance obligatoire à l’e-mail, avec mot de passe temporaire et changement obligatoire à la première connexion.
- [ ] Encadrer l’inscription par code d’établissement sans permettre de contourner le tenant ou le RBAC.
- [ ] Documenter les différences entre promoteur/propriétaire et comptes équipe.

## Clarification confirmée — circuit de service et validation équipe

- [ ] Autoriser uniquement Serveur/Serveuse à prendre une commande et à livrer le client.
- [ ] Faire transiter les boissons par le Gérant avant remise au Serveur/Serveuse.
- [ ] Créer immédiatement les comptes équipe saisis par le propriétaire.
- [ ] Créer en attente les comptes ouverts avec un code établissement.
- [ ] Ajouter la validation ou le refus de la demande par le propriétaire dans Personnel.
- [ ] Bloquer la connexion métier et l’accès tenant avant validation propriétaire.
- [ ] Activer le compte, le rôle et le changement de mot de passe initial après validation.

## Lot super-administration SaaS et affiliation

- [x] Auditer le fichier `codesecret debitmaster` sans exposer les secrets et vérifier la configuration Supabase/Moneroo.
- [x] Créer un rôle super-administrateur SaaS séparé des propriétaires d’établissements.
- [x] Ajouter les tables globales pour abonnements, affiliations, liens de parrainage, attributions, commissions et demandes de remboursement.
- [x] Ajouter l’interface master pour les revenus d’abonnement, établissements, affiliés et validations de remboursements.
- [x] Ajouter le dashboard affilié avec établissements attribués, état d’abonnement, commissions et seuil de demande à 20 000 XOF.
- [x] Brancher l’attribution par lien affilié sur la création d’établissement et le règlement d’abonnement Moneroo.
- [x] Garantir l’idempotence des webhooks Moneroo et empêcher toute commission sans paiement confirmé.
- [ ] Tester les calculs de commission, l’isolation RLS, les rôles et les parcours responsive.
- [ ] Préparer une pull request dédiée et attendre la validation manuelle avant la production.


## Lot diagnostic master et données de test

- [x] Inspecter le fichier local mis à jour et identifier les données intégrables sans exposer les secrets.
- [x] Comparer l’identifiant master du fichier avec le compte Auth réellement provisionné dans Supabase.
- [x] Vérifier l’état email/téléphone, le profil `SUPER_ADMIN/MASTER_ADMIN` et le mot de passe sans journaliser de valeur sensible.
- [x] Corriger ou reprovisionner proprement l’accès master après confirmation de la cause exacte.
- [x] Importer uniquement les données de test validées et compatibles avec le schéma DebitManager.
- [ ] Tester les sections master et affilié une par une avant toute fusion ou production.


## Lot correction connexion téléphone équipe

- [ ] Vérifier le format E.164 du numéro de la serveuse et son état dans Supabase Auth.
- [ ] Vérifier si le fournisseur téléphone Supabase est activé et si la route login utilise une stratégie compatible.
- [ ] Corriger le compte ou le routeur sans exposer le mot de passe.
- [ ] Tester la connexion serveuse en local et en production avec contrôle du tenant et du rôle.


## Lot rôles stocks, cuisine et supervision

- [ ] Limiter le Magasinier aux stocks autorisés : boissons, vivres cuisine ou les deux.
- [ ] Ajouter l’entrée en stock, la réception des livraisons et la préparation des sorties quotidiennes.
- [ ] Ajouter la remise des stocks boissons au Gérant et la remise des vivres au Chef cuisine.
- [ ] Réserver au Gérant la distribution des stocks de vente aux serveuses/serveurs.
- [ ] Faire recevoir au Chef cuisine les commandes de nourriture dans le KDS cuisine.
- [ ] Ajouter au Superviseur le contrôle de fin de journée : ventes réelles, stocks restants et activité du Magasinier.
- [ ] Tester les restrictions RBAC et l’affichage mobile de chaque rôle.


## Lot diagnostic définitif login serveuse

- [ ] Reproduire le refus avec le numéro de test sur la production réellement déployée.
- [ ] Vérifier que la production utilise la correction de résolution téléphone et identifier sa version.
- [ ] Comparer sans exposition le numéro, l’identifiant Auth technique, le mot de passe et le profil employé.
- [ ] Corriger la donnée ou le code responsable du refus.
- [ ] Retester le login téléphone et l’accès tenant après correction.


## Lot serveur/serveuse et reversement établissement

- [x] Limiter le dashboard serveur/serveuse à sa zone, ses tables, ses ventes, ses horaires, son repos et ses commissions.
- [x] Ajouter les onglets Commandes, Ventes et Profil avec filtrage par utilisateur connecté.
- [x] Permettre la sélection ou la création d’un client depuis une commande.
- [x] Brancher le règlement cash et Mobile Money via Moneroo sur les commandes de la serveuse.
- [x] Créer le reversement propriétaire-promoteur sans montant minimum.
- [x] Imposer une fenêtre de vérification de quatre heures avant validation d’un reversement établissement.
- [x] Déduire la commission SaaS avant le montant reversable et conserver une trace auditable.
- [ ] Tester les rôles, l’isolation des ventes et le parcours mobile en conditions connectées.


## Nouvelle clarification — dashboard Gérant et droits conditionnels

- [x] Afficher au Gérant la situation de toutes les serveuses : ventes, commissions, repos, zones, tables servies, jours et heures de service.
- [x] Ajouter au Gérant les indicateurs globaux de ventes et de stocks disponibles à son niveau.
- [x] Construire l’onglet Commandes Gérant avec toutes les commandes des serveuses et les transitions `PENDING → IN_PREPARATION → READY → HANDED_OFF → DELIVERED`.
- [x] Enregistrer l’identité de la serveuse lors de la prise en charge d’une commande et empêcher qu’une autre serveuse la revendique.
- [x] Afficher Plan de salle au Gérant seulement si l’Administrateur lui accorde la permission correspondante.
- [x] Afficher Gestion des serveuses au Gérant seulement si l’Administrateur lui accorde la permission correspondante.
- [x] Permettre, sous permission, l’affectation des zones, tables, horaires et jours de repos.
- [x] Rendre l’onglet Profil disponible à tous les rôles avec des droits limités à leur propre profil.
- [ ] Tester la matrice Gérant sans droit, Gérant avec droit et Administrateur avant fusion.
- [x] Ajouter la migration d’audit `received_by_user_id`, `received_at`, `delivered_by_user_id` et `delivered_at` sur les commandes.
- [x] Ajouter l’API et l’interface propriétaire pour accorder les droits `tables.view` et `team.manage` au Gérant.
- [x] Vérifier `pnpm typecheck`, `pnpm build` et le lint ciblé des fichiers du lot.
- [ ] Réaliser les scénarios métier connectés sur le preview avec des comptes de test.
