# Mémo — Migration des abonnements DebitMaster

## Objectif
Remplacer le catalogue actuel par quatre formules métier — Bar, Restaurant, Hôtels et Prestige — avec tarifs mensuels/annuels, réduction annuelle de 25 %, essai gratuit de 30 jours et accès fonctionnel cohérent.

## Périmètre
Inclus : catalogue serveur, tarifs XOF, interface de choix, paiement d’abonnement, affichage du statut, règles d’accès aux fonctionnalités, migration des données et classement de BAR SANTE PLUS en Prestige. Hors périmètre : modification du prestataire de paiement, suppression de données métier, migration destructive des établissements existants.

## Décisions
- Les quatre formules métier sont distinctes des deux périodes de facturation : mensuelle et annuelle.
- Tarifs : Bar 40 000 / 360 000 ; Restaurant 60 000 / 540 000 ; Hôtels 75 000 / 675 000 ; Prestige 100 000 / 900 000 XOF.
- La réduction annuelle affichée et calculée est de 25 % pour chaque formule.
- L’essai gratuit est fixé à 30 jours pour tout nouvel établissement.
- BAR SANTE PLUS est conservé comme donnée de test et classé Prestige.
- Les paiements restent vérifiés côté serveur et activés uniquement après confirmation fiable du prestataire.

## Sécurité
Les changements de plan et de tarif restent protégés côté serveur. Les droits fonctionnels ne reposent pas uniquement sur le frontend. Aucun secret de paiement ne sera ajouté au dépôt.

## Plan
- Remplacer le catalogue et le calcul des périodes.
- Ajouter/adapter la migration SQL des prix, essais et données de test.
- Mettre à jour les écrans et l’API d’abonnement.
- Implémenter les contrôles d’accès par formule si nécessaires.
- Exécuter typecheck, build, tests ciblés et contrôles de diff.
- Vérifier la compatibilité du paiement et documenter les limites.


## État d’exécution

Le catalogue a été implémenté côté serveur et dans l’interface d’abonnement. La migration Supabase `subscription_catalog_v2_20260921_retry` a été appliquée avec succès sur le projet DebitMaster. Elle crée les tarifs des quatre formules sur les périodicités mensuelle et annuelle, ajoute `billing_period` à l’historique des paiements, fixe l’essai par défaut à 30 jours, complète les essais TRIAL existants sans date et classe `BAR SANTE PLUS` en `PRESTIGE`.

La base contient 32 combinaisons tarifaires, soit quatre formules × deux périodicités × quatre types historiques d’établissement. La vérification de la donnée de test confirme que BAR SANTE PLUS est conservé, toujours en statut TRIAL et désormais en formule PRESTIGE. Le typecheck et le build Next.js passent après les changements.

Les fonctionnalités sont présentées par formule dans le catalogue : boissons pour Bar, boissons et repas pour Restaurant, boissons/repas/chambres pour Hôtels, et l’ensemble des fonctionnalités actuelles pour Prestige. Les paiements MTN MoMo continuent d’être initiés et confirmés côté serveur ; la périodicité est désormais persistée avec chaque paiement.


## Renommage de la donnée test

Le 21 septembre 2026, l’établissement test a été renommé de **BAR SANTE PLUS** en **LE TEMPLE DU PLAISIR**. Son identifiant reste inchangé, ainsi que son statut TRIAL et sa formule PRESTIGE.
