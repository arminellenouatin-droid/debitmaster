# Synthèse confidentielle — spécifications du plan Power

Cette note reprend uniquement les éléments fonctionnels nécessaires à l’analyse de DebitManager. Les mots de passe, clés et autres secrets présents dans le document source sont volontairement exclus.

## Établissement

Le document décrit l’établissement BAR SANTE PLUS, organisé autour de six activités : boissons, repas, gym, lavage, auberge et zone Wi-Fi.

## Catalogue fonctionnel

Pour les boissons, le catalogue comprend des bières, sucreries, boissons énergétiques, liqueurs et eaux, avec des conditionnements et formats distincts. Pour les repas, le document cite notamment café, omelette, salade composée, chawarma, panini viande, gbota, poulet bicyclette, bomiwo, aileron et tchassoun.

Les services hors circuit standard des serveuses sont le lavage (voiture et moto), l’auberge (nuitée et passe), la gym (abonnement, séance, tapis roulant et autre prestation listée dans le document) et la zone Wi-Fi. Le document demande donc une séparation des activités et des droits, plutôt qu’un simple catalogue unique visible par tous les profils.

## Organisation du personnel

Le personnel comprend deux groupes de serveuses, un superviseur, un propriétaire/directeur, un département cuisine avec une responsable des approvisionnements, un chef cuisine et un cuisinier, un département gym avec secrétaire et coach, un département auberge avec agent d’accueil, un gérant-caissier et un gérant adjoint, ainsi que des agents de lavage, de sécurité et d’inventaire.

Le superviseur dispose de responsabilités de recrutement et de gestion/approvisionnement du magasin central des boissons, tandis que le paiement des approvisionnements relève du propriétaire. La responsable cuisine doit voir uniquement les ventes de repas et les stocks cuisine ; le chef cuisine reçoit les commandes de repas des serveuses et signale leur préparation. La secrétaire gym vend les services de gym et transmet le point au gérant. L’agent auberge gère l’accueil, l’attribution des quatre chambres et les paiements, avec remise du point au gérant-caissier. Le gérant-caissier centralise les ventes des serveuses et des autres départements ; le gérant adjoint le supplée.

## Règles de visibilité à respecter

Les serveuses conservent le circuit de commande existant pour les boissons et repas, mais ne doivent pas accéder aux activités auberge, gym, Wi-Fi et lavage. Les autres départements doivent avoir des espaces et droits propres, avec remontée contrôlée vers le gérant et le propriétaire. Le document indique également que les comptes doivent pouvoir changer leur mot de passe ; aucun mot de passe par défaut n’est recopié dans cette synthèse.

## Questions à confirmer avant implémentation

Il reste à confirmer la tarification Power, le propriétaire à rattacher à l’établissement de test, la distinction entre produits vendus et services, les règles d’encaissement par activité, les droits détaillés de chaque profil, ainsi que le format exact des activités gym, auberge et Wi-Fi dans DebitManager.
