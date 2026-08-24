# DebitManager — Cadrage produit

## Positionnement

DebitManager est une application web SaaS responsive, pensée pour les téléphones, tablettes et ordinateurs, destinée aux bars, maquis, restaurants, boîtes de nuit et lounges. Elle centralise les commandes, tables, produits, stocks, employés, présences, paiements, trésorerie et reporting dans un espace par établissement.

## Utilisateurs prioritaires

Le premier utilisateur est le gérant d’un établissement qui veut suivre son activité sans dépendre de fichiers dispersés. Les autres rôles sont l’administrateur de boutique, le superviseur, le serveur ou barman, le cuisinier, le magasinier, le responsable des approvisionnements, le comptable et le secrétaire. Un espace séparé de super-administration pilotera la plateforme et les affiliés.

## MVP retenu

Le premier parcours vertical couvre l’inscription d’un exploitant, la création de son établissement, la sélection d’un abonnement, l’accès sécurisé à un tableau de bord et la création des premiers produits. Le paiement d’abonnement et les paiements opérationnels seront intégrés avec Moneroo uniquement. Le produit reste une application web responsive mobile-first, et non une application mobile native.

## Résultats attendus

Le gérant doit comprendre son état d’activité dès l’ouverture, pouvoir créer son établissement sans ambiguïté, inviter des collaborateurs avec des permissions limitées et préparer son catalogue. Chaque action critique doit être validée côté serveur, traçable et protégée par le tenant de l’établissement.

## KPI initiaux

Les indicateurs de validation du MVP sont le taux de création d’établissement après inscription, le taux de configuration terminée, le temps jusqu’à la création du premier produit, le taux d’erreur par parcours, le taux d’activation à sept jours et le nombre d’établissements actifs. Aucun chiffre ne sera simulé dans le produit.

## Hors périmètre du premier incrément

La paie complète, l’affiliation, les paiements réels via Moneroo, le mode hors ligne renforcé, la comptabilité avancée, le QR code client et les tests de charge seront traités dans les sprints prévus par le backlog après validation du socle et des contrats. KKiaPay et CinetPay sont explicitement hors périmètre.

## Critères de sortie du Sprint 0

L’architecture, le modèle de données, les rôles, les routes prioritaires, la stratégie de sécurité, les variables d’environnement, les critères de test et le plan de déploiement doivent être documentés avant d’ajouter des fonctionnalités métier.
