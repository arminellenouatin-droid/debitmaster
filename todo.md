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

## Nouveau chantier — intégration directe MTN MoMo
- [x] Auditer les routes Moneroo, les statuts de paiement et les variables actuellement utilisées.
- [x] Vérifier le contrat officiel MTN MoMo Bénin, Collection, Disbursement, webhooks et statuts.
- [x] Définir les variables serveur MTN MoMo sans exposer de secrets.
- [x] Remplacer l’encaissement des commandes et abonnements par Collection.
- [x] Ajouter les endpoints de reversement Disbursement avec confirmation explicite administrateur.
- [x] Sécuriser les callbacks, la vérification serveur, l’idempotence et les références uniques.
- [ ] Tester les flux sandbox puis préparer la configuration production avec les identifiants MTN du marchand.
- [ ] Retirer le webhook Moneroo historique uniquement après validation complète des flux MTN MoMo.

> Décision fonctionnelle : MTN MoMo devient le fournisseur de paiement utilisé par DebitManager. Moneroo est abandonné pour les nouveaux paiements ; l’ancien historique reste lisible.

## Nouveau chantier — parcours public et programme d’affiliation
- [x] Auditer le parcours public, l’authentification et l’espace affilié existant.
- [x] Définir les données, politiques RLS et règles d’attribution durable des établissements.
- [x] Ajouter le bouton « S’affilier » et le parcours inscription/connexion/acceptation.
- [x] Générer le lien affilié et rattacher les établissements aux renouvellements.
- [x] Calculer 10 % de commission et afficher le suivi dans l’espace affilié.
- [ ] Tester les scénarios d’inscription, d’abonnement, de renouvellement et d’accès avec les variables Supabase de production.
- [x] Documenter et préparer le PR de livraison.

> Décision fonctionnelle : une personne peut être affiliée sans posséder d’établissement. L’attribution du lien doit rester attachée à l’établissement pour ses renouvellements futurs.


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


## Nouvelle clarification — espace Magasinier

- [x] Limiter le Dashboard Magasinier aux mouvements de stocks, alertes et indicateurs stock autorisés.
- [x] Limiter l’onglet Gestion des stocks à la création de produits, entrées, seuils d’alerte, sorties et approvisionnement.
- [x] Autoriser les sorties uniquement vers `BAR` ou `CUISINE`, avec traçabilité de l’auteur, du produit, de la quantité et de la destination.
- [x] Ajouter la création de demandes d’approvisionnement avec statut et suivi tenant-scoped.
- [x] Refuser au Magasinier les ventes, commandes clients, paiements, finances et gestion du personnel.
- [x] Conserver l’onglet Profil pour le Magasinier comme pour tous les rôles.
- [x] Vérifier le modèle SQL, les contraintes, les fonctions atomiques, `pnpm typecheck`, `pnpm build` et `git diff --check`.
- [ ] Tester les droits `MAGASINIER`, les sorties BAR/CUISINE, les alertes, l’approvisionnement et l’isolation inter-établissements avec les comptes de test.
- [x] Ouvrir la PR #23 et vérifier que les contrôles Vercel sont réussis.
- [ ] Attendre la validation métier de l’utilisateur avant fusion et production.


## Règle de méthode confirmée par l’utilisateur

- [ ] Avant chaque nouvelle modification, recenser les erreurs observées, les données disponibles et les éléments manquants.
- [ ] Poser les questions nécessaires lorsque le besoin, les permissions, le parcours ou le modèle de données ne sont pas certains.
- [ ] Reformuler précisément la correction proposée et attendre la confirmation de l’utilisateur avant tout changement de code ou de base.
- [ ] Ne lancer aucun déploiement, fusion, migration ou modification irréversible avant validation explicite du résultat testé.


## Règles confirmées — magasins et Magasin comptoir

- [x] Permettre à chaque établissement de définir ses propres prix de vente.
- [x] Historiser le prix d’achat sur chaque facture et chaque entrée de stock, avec variation possible d’un achat à l’autre.
- [x] Permettre au Magasinier de créer plusieurs lieux physiques de stockage par établissement.
- [x] Créer ou identifier le lieu réservé au Gérant sous le nom exact **Magasin comptoir**.
- [x] Interdire au Magasinier toute sortie ou mouvement direct depuis le Magasin comptoir.
- [x] Autoriser le Magasinier à envoyer des produits vers le Magasin comptoir avec un transfert en attente.
- [x] Ne débiter le magasin source et ne créditer le Magasin comptoir qu’après confirmation **Reçu** par le Gérant.
- [x] Notifier le Gérant lorsqu’un transfert vers le Magasin comptoir est envoyé.
- [x] Faire valider par l’utilisateur le modèle fonctionnel complet avant toute migration ou modification de code.
- [x] Confirmer que le seuil de sécurité est défini par produit, comme le seuil d’alerte.
- [x] Implémenter le modèle validé uniquement sur DebitManager, sans toucher au projet Envol Africa Magazine.


## Clarification sur les données existantes

- [x] Confirmer que les produits et stocks actuellement présents sont des données de test du compte d’essai.
- [x] Ne pas affecter automatiquement ces données de test à un magasin réel ou créer une migration de stock à partir de leur `current_stock`.
- [x] Utiliser le nouveau modèle multi-magasins pour les nouvelles créations et entrées, avec un rattachement explicite au magasin choisi.


## Refonte interface Gestion des stocks — sous-onglets

- [ ] Ajouter les sous-onglets Vue d’ensemble, Magasins, Catégories, Produits, Entrées de stock, Livraisons au Gérant et Approvisionnement.
- [ ] Afficher la liste des éléments existants dans chaque sous-onglet avant les actions de création.
- [ ] Masquer les formulaires d’ajout par défaut et les ouvrir avec un bouton « Ajouter ».
- [ ] Adapter la mise en page ordinateur pour éviter l’empilement vertical des formulaires.
- [ ] Conserver une navigation mobile lisible et les permissions serveur existantes.
- [ ] Vérifier les états vides, les retours d’erreur et les actions de modification/archivage.

## Correctif demandé — création de tables dans le Plan de site

- [x] Auditer l’API et l’interface actuelles de gestion des tables.
- [x] Ajouter un formulaire de création avec nom, zone et capacité.
- [x] Rafraîchir la liste des tables après création et afficher les erreurs métier.
- [x] Vérifier l’isolation tenant et la permission `tables.manage`.
- [x] Exécuter le type-check et le build de production.
- [x] Publier le correctif dans un PR DebitManager.

## Correctif demandé — valorisation du stock Magasinier

- [ ] Vérifier la source actuelle du prix utilisée par le Dashboard Magasinier.
- [ ] Utiliser le prix d’achat réel de la dernière entrée ou du stock concerné.
- [ ] Afficher les quantités et la valeur d’achat totale sans utiliser le prix de vente.
- [ ] Vérifier les cas sans historique de prix d’achat et l’isolation tenant.
- [ ] Exécuter le type-check et le build de production.
- [ ] Publier le correctif dans un PR DebitManager.

## Règle confirmée — valorisation du stock Magasinier

- [x] Calculer le coût moyen pondéré à partir des entrées stock_purchases.
- [x] Afficher la valeur totale d’inventaire au coût d’achat, jamais au prix de vente.
- [x] Afficher le coût unitaire moyen et les quantités dans l’inventaire.
- [x] Prévoir un état explicite lorsqu’aucun prix d’achat n’est encore enregistré.
- [x] Vérifier le type-check, le build et publier le PR #49 DebitManager.

## Nouveau chantier — propriétaire, plans SaaS et cockpit complet

- [ ] Auditer les offres, abonnements, paiements et statuts d’expiration existants.
- [ ] Vérifier le rôle propriétaire et la résolution de ses permissions établissement.
- [ ] Définir les règles de souscription, changement de formule, renouvellement et expiration.
- [ ] Bloquer les opérations établissement lorsque l’abonnement est expiré ou impayé, en conservant l’accès nécessaire au renouvellement.
- [ ] Construire la vue Plans avec paiement, formule active et historique utile.
- [ ] Construire les KPI propriétaire : ventes, classement serveuses, stocks, achats, dépenses et marge brute.
- [ ] Ajouter les filtres jour, période et critères opérationnels.
- [ ] Vérifier les données réelles, la sécurité tenant, le responsive et le build.

## Offres confirmées par le document métier

Les quatre formules de référence sont désormais fixées : **Base** mensuelle à **50 000 XOF**, **Moyenne** trimestrielle à **130 000 XOF**, **Semestrielle** à **240 000 XOF** et **Suprême** annuelle à **400 000 XOF**. Le document indique aussi que le tarif Bar restaurant est multiplié par 1,5 et celui de Boîte de nuit / Lounge par 2 par rapport au tarif Buvette.

- [ ] Confirmer si les coefficients d’activité s’appliquent automatiquement au catalogue de plans.
- [ ] Confirmer les règles non précisées : grâce de renouvellement, baisse de formule et consultation après expiration.

## Règles métier confirmées

Les coefficients sont automatiques selon l’activité : Buvette ×1, Bar restaurant ×1,5, Boîte de nuit / Lounge ×2. À l’expiration, l’établissement ne peut plus utiliser le SaaS tant qu’un renouvellement de paiement n’a pas été validé. La marge brute est calculée par la formule : ventes totales moins coût des stocks vendus.

- [ ] Implémenter les coefficients d’activité dans le catalogue et le montant Moneroo.
- [ ] Enforcer le blocage à expiration sur les opérations de l’établissement.
- [ ] Calculer la marge brute à partir des ventes et du coût des articles vendus.


## Chantier propriétaire — abonnements SaaS et cockpit financier

- [x] Confirmer les quatre offres Base, Moyenne, Semestrielle et Suprême à partir du document métier.
- [x] Appliquer les coefficients automatiques Buvette ×1, Bar restaurant ×1,5 et Boîte de nuit / Lounge ×2.
- [x] Ajouter la page propriétaire Paramètres → Plans avec calcul tarifaire serveur et redirection Moneroo.
- [x] Activer la formule et l’échéance depuis le webhook Moneroo confirmé.
- [x] Bloquer les opérations d’un établissement expiré tout en conservant le renouvellement propriétaire.
- [x] Ajouter les KPI propriétaire filtrables : ventes payées, classement, stocks, achats, coût vendu et marge brute.
- [x] Appliquer les politiques RLS liées à l’expiration et à la lecture propriétaire de l’historique.
- [x] Vérifier `pnpm exec tsc --noEmit`, `pnpm build` et `git diff --check`.
- [x] Ouvrir le PR #50.
- [ ] Définir puis brancher une source réelle pour les dépenses ; le cockpit les signale actuellement comme non configurées.


## Clarification propriétaire — séparation établissement / SaaS

- [ ] Retirer la présentation de l’abonnement comme bloc principal des paramètres opérationnels.
- [ ] Maintenir le Dashboard propriétaire centré sur toutes les données réelles de son établissement.
- [ ] Conserver tous les onglets opérationnels correspondant aux droits du propriétaire.
- [ ] Ajouter un encart de statut d’abonnement distinct avec un bouton dédié vers les formules SaaS.
- [ ] Vérifier que le propriétaire conserve l’accès à la gestion de l’abonnement même lorsque l’établissement est expiré.
- [ ] Ne modifier le code qu’après validation de cette architecture d’interface par l’utilisateur.


## Priorité confirmée — compte propriétaire avant abonnement

- [ ] Finaliser le dashboard métier complet de l’établissement avant d’enrichir les formules SaaS.
- [ ] Vérifier que le propriétaire retrouve tous les KPI : ventes, dépenses, stocks, achats, commandes et meilleurs vendeurs.
- [ ] Vérifier que le propriétaire retrouve tous les onglets et droits opérationnels des rôles de son établissement.
- [ ] Réduire la présence de l’abonnement à deux commandes séparées : statut et mise à jour de l’abonnement.
- [ ] Ne pas mélanger les formules SaaS avec les indicateurs ou opérations métier du propriétaire.


## Correction abonnement — types d’établissement confirmés

- [ ] Ajouter l’onglet **Bar** comme type de référence.
- [ ] Ajouter l’onglet **Bar restaurant** avec coefficient ×1,5.
- [ ] Ajouter l’onglet **Boîte de nuit / Lounge** avec coefficient ×2.
- [ ] Afficher les quatre formules sous chacun des trois onglets.
- [ ] Envoyer au paiement le montant correspondant au type sélectionné.
- [ ] Vérifier le responsive, les montants et le build, puis publier le correctif.


## Complément grille tarifaire — contenu des offres

- [ ] Extraire du document métier les fonctionnalités exactes de Base, Moyenne, Semestrielle et Suprême.
- [ ] Distinguer les services inclus et les variations entre formules sans inventer de contenu.
- [ ] Ajouter le détail lisible sous chaque carte tarifaire des trois onglets d’activité.
- [ ] Vérifier l’affichage mobile, les montants et le build, puis mettre à jour le PR dédié.


## Nouvelle définition confirmée — offres d’activité et réductions

Les offres sont organisées par activité : **Bar/buvette** pour la vente de boissons seules ; **Bar restaurant** pour boissons et repas ; **Boîte de nuit/Lounge bar** pour boissons, champagnes, autres spiritueux et vins. Chaque activité propose quatre durées de paiement : **1 mois, 3 mois, 6 mois et 12 mois**. La réduction augmente avec la durée.

- [ ] Définir les pourcentages exacts de réduction pour 3, 6 et 12 mois si le document ne les précise pas.
- [ ] Afficher le contenu métier de chaque activité sous son offre.
- [ ] Afficher les quatre durées, le prix remisé, le prix de référence et l’économie réalisée.
- [ ] Synchroniser l’offre et la durée sélectionnées avec Moneroo.


## Réductions calculées — règle confirmée

Pour chaque formule, la réduction est calculée ainsi : `100 × (prix Base mensuel − prix de la période / nombre de mois) / prix Base mensuel`. Les taux issus des prix Bar/buvette sont : 1 mois = 0 %, 3 mois = 13,33 %, 6 mois = 20 %, 12 mois = 33,33 %. Le prix final de chaque activité applique ensuite son coefficient propre.

- [ ] Ajouter ces taux et les économies aux données retournées par l’API.
- [ ] Afficher prix total, prix mensuel moyen, réduction et économie sous chaque offre.
- [ ] Vérifier que Moneroo reçoit le prix total exact de la formule et de l’activité sélectionnées.


## Correctif paiement — montant de la formule sélectionnée

- [ ] Identifier l’origine du montant obsolète affiché sur le bouton de paiement.
- [ ] Synchroniser le libellé du bouton avec la formule et l’activité sélectionnées.
- [ ] Vérifier que le montant envoyé à Moneroo est recalculé côté serveur et correspond à l’affichage.
- [ ] Tester Base, Moyenne, Semestrielle et Suprême pour Bar, Bar restaurant et Boîte de nuit/Lounge.

## Clarification MTN MoMo — Collection classique pour DebitManager
- [ ] Utiliser uniquement la souscription MTN MoMo **Collection classique / RequestToPay** pour DebitManager.
- [ ] Ne pas utiliser Collection Widget pour le parcours actuel.
- [ ] Choisir le pays sandbox compatible et vérifier la devise de test.
- [ ] Configurer et tester API User, API Key, RequestToPay et callback.

> Le test concerne uniquement DebitManager. Le nom éventuel « ENVOL AFRICA » dans les identifiants sandbox est un libellé de souscription d’essai et ne doit entraîner aucune modification du projet Envol Africa Magazine.

## Bug prioritaire — bouton Commander serveuse
- [ ] Reproduire la soumission et inspecter les erreurs navigateur et réseau.
- [ ] Vérifier la fonction de validation, les données de commande et les champs obligatoires.
- [ ] Contrôler la route API de création et les contraintes Supabase/RLS.
- [ ] Corriger le blocage et afficher un retour explicite à la serveuse.
- [ ] Tester création, rafraîchissement des commandes et réception côté gérant/cuisine.


## Nouveau lot — diagnostic MTN MoMo « Currency not supported »

- [x] Tracer la valeur de devise construite par le formulaire de paiement et les routes serveur.
- [x] Vérifier le code pays, la devise et le produit MTN MoMo associés au sandbox Bénin/XOF.
- [x] Corriger le mapping sans relancer de paiement avant validation.
- [x] Contrôler le build et le déploiement Production.
- [ ] Reprendre le test sandbox de 1 000 XOF pour la serveuse Ella et documenter le résultat.

> Ne jamais afficher ni consigner les secrets MTN MoMo ou les identifiants Supabase/Vercel dans ce fichier.


## Nouveau lot — échec de vérification du statut MTN MoMo

- [ ] Examiner la réponse et le code HTTP renvoyés par la route de statut MTN MoMo.
- [ ] Vérifier le mapping des statuts fournisseur vers les statuts locaux et le comportement du polling.
- [ ] Identifier si l’erreur vient du déploiement utilisé, des identifiants, de la référence ou d’un format de réponse inattendu.
- [ ] Corriger la gestion du statut sans créer ni relancer un paiement en double.
- [ ] Revalider le build, le webhook et le statut du paiement existant avant le prochain essai.

> Ne jamais écrire dans ce fichier de numéro de téléphone, de référence MTN MoMo, de jeton ou de secret.


## Nouveau lot — cadrage du plan Power
- [x] Lire BARSANTEPLUS.docx depuis le dossier du projet DebitManager.
- [x] Extraire les activités, rôles, services, produits, particularités et données de test utiles au plan Power.
- [x] Écarter les mots de passe, clés et secrets de toute note, réponse ou modification de code.
- [x] Comparer les exigences Power avec les modèles et permissions existants de DebitManager.
- [x] Poser les questions restantes avant toute création de société ou écriture en base.

> Périmètre strict : DebitManager uniquement ; ne pas consulter ni modifier Envol Africa.


## Décisions validées — BAR SANTE PLUS / Power
- [x] Ajouter le plan d’abonnement **Power** au-dessus des trois plans existants, avec un prix de base de 150 000 XOF par mois.
- [x] Prévoir dans l’administration SaaS la modification des prix des quatre plans et de leurs périodes.
- [x] Créer BAR SANTE PLUS à Abomey, Bénin, avec Directeur comme propriétaire principal et tous les droits.
- [x] Activer les six activités : boissons, repas, gym, lavage, auberge et Wi-Fi.
- [x] Donner au superviseur le droit de créer le personnel, les activités et les prix, ainsi que de gérer les salaires et la liste du personnel.
- [x] Configurer le magasin central boissons vers le magasin comptoir boissons ; créer un magasin cuisine séparé ; ne pas créer de magasin pour les autres activités.
- [x] Configurer les encaissements par équipe avec remontée de fin de journée ; le gérant encaisse directement le Wi-Fi.
- [x] Configurer l’auberge avec attribution des quatre chambres et paiement des nuitées/passes.
- [x] Réserver ces particularités exclusivement au plan Power et ne pas modifier les plans standards.

**État :** implementation et peuplement Supabase terminés ; validation Production après fusion de la PR #59.

> Les mots de passe du document restent confidentiels et ne sont pas écrits dans ce suivi.


## Décision d’authentification — comptes de test Power
- [x] Générer des alias e-mail internes de test uniquement pour les membres sans e-mail dans le document.
- [x] Conserver les vrais numéros de téléphone comme identifiants opérationnels des membres.
- [x] Vérifier les doublons avant toute création de compte et ne pas modifier les utilisateurs existants.
- [x] Ne pas imposer le changement de mot de passe lors de la première connexion pour ce jeu d’essai.


## Nouveau lot — en-tête de compte et notifications

- [ ] Auditer le shell partagé, la route Profil/Paramètres, la déconnexion et la table des notifications.
- [ ] Définir le compteur des notifications non lues et les états cloche vide, badge, chargement et erreur.
- [ ] Ajouter l’accès Profil/Compte dans toutes les sections du dashboard.
- [ ] Ajouter le menu de paramétrage du compte et la déconnexion sécurisée.
- [ ] Ajouter la cloche de notifications et le badge coloré dans l’en-tête partagé.
- [ ] Tester les rôles, le responsive, l’accessibilité clavier et le rafraîchissement du compteur.


## Nouveau lot — paramètres spéciaux Power

- [ ] Ajouter au compte propriétaire Power un réglage activé/désactivé pour le système zones et tables.
- [ ] Rendre la table et la zone obligatoires uniquement quand ce réglage est activé.
- [ ] Autoriser le service sans zone ni table quand le réglage est désactivé.
- [ ] Ajouter le choix de paiement établissement **Simple** ou **Personnel**.
- [ ] En mode Simple, conserver le compte MTN MoMo DebitManager et le reversement à l’établissement.
- [ ] En mode Personnel, prévoir une configuration MTN MoMo propre à l’établissement sans exposer les secrets au navigateur.
- [ ] Restreindre la modification de ces paramètres au propriétaire de l’établissement Power.
- [ ] Tester les commandes, les paiements, les droits et les migrations sans modifier les plans standards.


## Clarification validée — configuration MTN MoMo Personnel

- [x] Afficher dans le compte propriétaire Power les champs de configuration MTN MoMo nécessaires au mode Personnel.
- [x] Enregistrer les credentials via le serveur, jamais dans le navigateur ni en clair dans l’interface.
- [x] Afficher uniquement l’état configuré et des informations masquées après enregistrement.
- [ ] Ajouter un test de configuration qui ne déclenche aucun paiement.
- [ ] Permettre le remplacement ou la suppression des credentials sans permettre leur relecture.


## Décision de sécurité confirmée — secrets MTN MoMo Personnel

- [x] Vérifier si un coffre de secrets privé est disponible dans le projet Supabase DebitManager : l’extension Vault n’est pas disponible.
- [x] Chiffrer les credentials avec AES-256-GCM côté serveur et une clé secrète Vercel dédiée.
- [x] Ne jamais renvoyer les secrets complets au navigateur ni les écrire dans les logs.
- [x] Limiter la configuration, le remplacement et la suppression au propriétaire d’un établissement Power.
- [ ] Ajouter un test d’authentification MTN MoMo sans déclencher de paiement.

## Incident connexion production — message générique

- [ ] Identifier l’exception serveur qui transforme la connexion téléphone en message « Impossible de vous connecter pour le moment. ».
- [ ] Corriger le fallback des comptes Auth historiques sans exposer les secrets.
- [ ] Valider le build et le nouveau preview avant de demander un nouveau test production.

## Incident refus d’identifiants BAR SANTE PLUS — nouveau test

- [ ] Reproduire le refus avec le compte et le format exacts utilisés par l’utilisateur.
- [ ] Vérifier le déploiement et comparer le mot de passe Auth réel sans l’exposer.
- [ ] Corriger la cause exacte puis retester le login et l’accès tenant.

## Suivi PR correctif login après fusion

- [ ] Vérifier le commit final de connexion et le PR réellement ouvert après la fusion du PR précédent.
- [ ] Confirmer que le lien communiqué pointe vers une révision non fusionnée contenant le correctif.

## Périmètre confirmé — test connexion Power BAR SANTE PLUS

- [x] Tester un compte réel créé pour BAR SANTE PLUS uniquement.
- [x] Ne consulter ni modifier les formules standard ni les autres établissements.
- [x] Corriger uniquement la cause empêchant le personnel BAR SANTE PLUS de se connecter.
- [x] Retester le compte et l’accès à son tenant Power après correction.

## Configuration Vercel confirmée — DebitManager Power

- [x] Vérifier la variable serveur Supabase active dans le projet Vercel DebitManager.
- [x] Corriger la variable en Production, Preview et Development sans afficher sa valeur. La production a été corrigée ; le preview sera régénéré lors de son prochain déploiement.
- [x] Retester la connexion de BAR SANTE PLUS sur la production : réponse HTTP 200 avec session créée.

## Rotation des mots de passe — BAR SANTE PLUS Power

- [ ] Lire le mot de passe mis à jour sans l’afficher.
- [ ] Vérifier la liste exacte des comptes du personnel du tenant BAR SANTE PLUS.
- [ ] Réinitialiser uniquement leurs mots de passe Auth.
- [ ] Tester une connexion avec le nouveau secret sans le révéler.

## Correction logout — DebitManager

- [ ] Vérifier pourquoi la réponse JSON du logout est affichée comme une page.
- [ ] Rediriger le client vers `/connexion` après suppression de session.
- [ ] Tester Sign out depuis BAR SANTE PLUS Power.

## Rotation du mot de passe propriétaire — BAR SANTE PLUS Power

- [ ] Lire la nouvelle valeur dans le document sans l’afficher.
- [ ] Vérifier le compte propriétaire du tenant BAR SANTE PLUS.
- [ ] Réinitialiser uniquement son mot de passe Auth.
- [ ] Tester sa connexion avec la nouvelle valeur sans la révéler.

## Paramètres de compte utilisateur — DebitManager

- [x] Auditer la page Profil et les données de profil existantes.
- [x] Ajouter la modification prénom, nom et e-mail avec validation serveur.
- [x] Ajouter la modification du mot de passe avec confirmation et déconnexion de sécurité si nécessaire.
- [x] Ajouter l’upload sécurisé de la photo de profil dans le profil.
- [x] Vérifier que chaque utilisateur ne modifie que son propre compte.
- [ ] Tester les comptes propriétaire et personnel de BAR SANTE PLUS Power après déploiement du correctif.

## Commandes propriétaire — BAR SANTE PLUS Power

- [ ] Remplacer le libellé et le lien Cuisine par Commandes dans le sidebar propriétaire.
- [ ] Centraliser boissons et repas dans le suivi propriétaire.
- [ ] Afficher les états prise en charge, préparation, prêtes à remettre et remise au service.
- [ ] Ajouter les volumes, montants, détail de journée et filtres opérationnels.
- [ ] Vérifier que cette évolution reste limitée à BAR SANTE PLUS Power.

## Vente propriétaire — BAR SANTE PLUS Power

- [ ] Ajouter l’onglet Vente au sidebar du propriétaire.
- [ ] Agréger le chiffre d’affaires payé par activité et par personne.
- [ ] Ajouter filtres, indicateurs, tendance graphique et tableaux responsive.
- [ ] Vérifier les flux d’encaissement des activités Power hors commandes lorsque leurs écrans de vente seront disponibles.

## Supervision stocks propriétaire — BAR SANTE PLUS Power

- [ ] Ajouter la vue propriétaire des stocks boissons et cuisine.
- [ ] Afficher les magasins principal et comptoir pour les boissons.
- [ ] Ajouter le détail par produit, secteur, type et période d’achat/vente.
- [ ] Ajouter la situation des inventaires et les écarts constatés.
- [ ] Vérifier l’isolation tenant et les données réelles avant PR.

## Superviseur Power — pilotage et approvisionnement boissons

- [ ] Donner au Superviseur les onglets de pilotage du propriétaire selon la matrice autorisée.
- [ ] Ajouter l’onglet Approvisionnement limité aux boissons.
- [ ] Sélectionner les produits en alerte et saisir les quantités à commander.
- [ ] Générer un bon de commande depuis l’approvisionnement.
- [ ] Vérifier les restrictions tenant, rôle et absence d’accès cuisine.

## Correction Superviseur — alignement complet et approvisionnement

- [ ] Reproduire exactement les onglets et informations du Propriétaire chez le Superviseur Power.
- [ ] Diagnostiquer et corriger l’erreur de chargement de la situation des stocks.
- [ ] Ajouter prix unitaires, quantités, total et lancement d’une commande d’approvisionnement boissons.
- [ ] Afficher les demandes du magasin comptoir et permettre leur livraison au Superviseur.
- [ ] Rendre les commandes lancées visibles au Propriétaire et au Chargé des inventaires.

## Catalogue produits Power — catégories, sous-catégories et étiquettes

- [ ] Vérifier les champs actuels des produits et catégories dans le code et les migrations.
- [ ] Structurer Boissons et Repas avec leurs sous-catégories prévues.
- [ ] Prévoir une étiquette de format/conditionnement modifiable pour les boissons.
- [ ] Permettre au Superviseur de créer et modifier nom, catégorie, sous-catégorie, prix de vente et étiquette.
- [ ] Conserver les prix d’achat et les seuils stock existants sans perte de données.

## Bug à corriger — paramétrage des alertes produit

- [x] Reproduire l’échec du paramétrage des seuils d’alerte et de sécurité.
- [x] Vérifier le payload, le contrat API, les permissions et la contrainte des seuils.
- [x] Corriger le flux puis valider sur le tenant Power BAR SANTE PLUS.

## Blocage production — chargement des espaces Power

- [ ] Diagnostiquer « Impossible de charger les indicateurs de l’établissement ».
- [ ] Diagnostiquer « Impossible de charger la file des commandes ».
- [ ] Diagnostiquer « Impossible de charger le chiffre d’affaires ».
- [ ] Diagnostiquer « Impossible de charger l’équipe ».

## Services Power — GYM, Lavage et Auberge

- [ ] Paramétrer les prestations et tarifs Gym sans stock.
- [ ] Ajouter ventes, clients, abonnement et caisse Gym.
- [ ] Ajouter ventes, clients et caisse Lavage sans stock.
- [ ] Ajouter ventes, chambres, pass, nuitées et occupation Auberge.
- [ ] Relier les reversements des caisses d’activité à la caisse principale du gérant.

## Audit global Power — BAR SANTE PLUS

- [ ] Auditer les rôles, permissions, routes et menus de chaque compte Power.
- [ ] Corriger la file des commandes et le pilotage refusé pour les comptes autorisés.
- [ ] Vérifier que les comptes Gym, Lavage et Auberge n’accèdent pas aux stocks.
- [ ] Réparer la persistance de la photo de profil et son affichage dans l’en-tête.
- [ ] Tester chaque compte et chaque menu dans le navigateur sans exposer de données sensibles.

## Mise à jour tarifs Power — BAR SANTE PLUS

- [ ] Vérifier les tarifs actuels des prestations Gym et des chambres Auberge.
- [ ] Appliquer les tarifs et unités confirmés par l’utilisateur.
- [ ] Vérifier les valeurs finales sans exposer de données de connexion.

## Séparation des prestations par activité — BAR SANTE PLUS

- [ ] Limiter les prestations Gym au compte Secrétaire Gym et à l’activité Gym.
- [ ] Limiter les prestations Auberge au compte affecté à l’activité Auberge.
- [ ] Empêcher l’affichage croisé des prestations dans les autres comptes métier.
- [ ] Vérifier la visibilité propriétaire/superviseur uniquement dans leurs vues de pilotage.

## WIFI — compte Gérant BAR SANTE PLUS

- [ ] Enregistrer les tickets reçus par type et quantité.
- [ ] Paramétrer 100 XOF pour 3 heures, 500 XOF pour 72 heures et 2 500 XOF pour un mois.
- [ ] Enregistrer les tickets vendus à la demande des clients.
- [ ] Calculer le solde disponible par type de ticket.
- [ ] Relier les ventes WIFI au Dashboard et à la caisse centrale du Gérant.

## Blocage Gérant — erreurs de chargement en production

- [ ] Reproduire les erreurs 404 et 500 des routes commandes, stock, serveuses et dashboard.
- [ ] Comparer les requêtes aux colonnes et relations du schéma DebitManager.
- [ ] Corriger le contexte tenant, les permissions et les relations fragiles.
- [ ] Vérifier le traitement client des erreurs de commandes.
- [ ] Tester les écrans Gérant avant le PR de rattrapage.

## Audit général design et UX

- [ ] Auditer le design system, les tokens, la typographie et les contrastes.
- [ ] Auditer le shell global, la sidebar, l’en-tête et la navigation mobile.
- [ ] Auditer les dashboards et parcours par rôle Power.
- [ ] Vérifier les états de chargement, vide, erreur, succès, désactivation et focus.
- [ ] Vérifier le responsive, l’accessibilité et la densité des écrans métier.
- [ ] Produire un rapport de recommandations priorisées et un plan de refonte.

## Superviseur — catalogue et stocks Boissons / Repas

- [x] Confirmer si le prix d’achat doit être saisi avec chaque entrée de stock et si le prix de vente reste au niveau du produit.
- [x] Confirmer si les étiquettes concernent uniquement les boissons et quelle liste initiale doit être proposée.
- [x] Confirmer si le Superviseur peut créer/modifier/supprimer les catégories et sous-catégories, ou seulement attribuer celles existantes.
- [x] Confirmer les magasins concernés par l’entrée de stock pour boissons et repas.
- [x] Auditer et corriger les permissions, APIs et écrans Superviseur pour ces opérations.

## Règles confirmées — Superviseur catalogue et approvisionnement

- [x] Saisir le prix d’achat à chaque entrée en stock, car il peut varier d’une facture à l’autre.
- [x] Conserver le prix de vente au niveau du produit et le rendre modifiable par le Superviseur.
- [x] Autoriser le Superviseur à créer, modifier et supprimer les catégories et sous-catégories selon les règles de stock existantes.
- [x] Autoriser des étiquettes pour les boissons et permettre la création d’étiquettes spécifiques aux repas si nécessaire.
- [x] Faire passer tous les achats par les magasins principaux : magasin central boissons pour les boissons et magasin cuisine pour les repas.
- [x] Interdire tout approvisionnement direct du magasin comptoir.
- [ ] Faire fonctionner le magasin comptoir par demande de mise à disposition de boissons depuis le magasin central, avec validation et traçabilité du transfert.

## Blocage Superviseur — opérations catalogue et approvisionnement

- [x] Reproduire la création de produit sans réaction et relever la réponse API exacte.
- [x] Reproduire l’approvisionnement refusé et vérifier la fonction SQL, le magasin et la famille produit.
- [x] Reproduire la modification du prix de vente et vérifier le payload ainsi que la persistance.
- [x] Ajouter une suppression de produit protégée, avec confirmation et règles de stock non nul.
- [ ] Tester les quatre opérations dans le tenant Power BAR SANTE PLUS avant le PR.

## Règle confirmée — réservation des demandes comptoir

- [ ] À la validation par le Superviseur, réserver et verrouiller les quantités dans le magasin central.
- [ ] Déduire physiquement le magasin central et créditer le magasin comptoir uniquement après confirmation de réception par le Gérant.
- [ ] Empêcher qu’une quantité réservée soit réutilisée dans une autre demande ou une autre opération.
- [ ] Définir et tester les cas de stock insuffisant, annulation et livraison partielle avant implémentation.
