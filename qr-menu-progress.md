# Avancement menu QR — BAR SANTE PLUS

## Déjà implémenté

Le dépôt contient maintenant un jeton QR signé côté serveur, un menu public dynamique à l’adresse `/menu/[token]`, la lecture des produits BEVERAGE et KITCHEN du tenant, la recherche sans accent, les filtres de catégories, le panier mobile, l’envoi de commande et le paiement Mobile Money public protégé par le même jeton. Le menu reprend la direction lounge sombre et ambre de la maquette fournie.

L’API des tables renvoie aussi un lien public signé par table. L’écran de plan de salle ajoute le téléchargement local du PNG QR et un lien pour ouvrir le menu. Une commande publique est créée avec la table réelle, les prix relus côté serveur et les notifications existantes vers GERANT pour les boissons et CHEF_CUISINE/CUISINIER pour les repas.

## Garde-fous

Le navigateur n’est pas une source de vérité pour le tenant, la table, les prix ou les unités de préparation. Le jeton est signé avec `PUBLIC_MENU_TOKEN_SECRET` ou `JWT_SECRET`. Le paiement ne peut viser que la commande liée à la table du jeton et doit correspondre au solde serveur. La commande n’est jamais marquée payée avant la confirmation du fournisseur.

## Point à décider avant l’extension des activités

Les prestations GYM, LAVAGE, AUBERGE et WIFI utilisent actuellement des tables comptables distinctes et exigent `created_by` comme utilisateur Auth. Pour une demande publique sans compte opérateur, il faut choisir si l’opération doit être enregistrée comme une demande en attente attribuée à un opérateur, ou comme une vente payée immédiatement au nom technique de l’établissement. Il faut aussi confirmer si les réservations Auberge et prestations Gym/Lavage doivent être payées uniquement par Mobile Money depuis le QR ou accepter un règlement au comptoir. Cette décision évite d’attribuer à tort une vente publique au propriétaire ou de déplacer un encaissement avant validation de l’opérateur.

## Règles confirmées par l’utilisateur

Une commande client peut contenir plusieurs lignes destinées à des activités différentes. Le système conserve une facture globale et ventile les lignes par destination : boissons vers le Gérant, repas vers le Chef cuisine, Gym vers la section Gym, Auberge vers la section Auberge, Lavage vers la section Lavage et Wi-Fi vers le Gérant. Le client peut payer en Mobile Money ou choisir les espèces ; dans ce dernier cas, il remet l’argent à une serveuse et l’encaissement reste traçable avant validation.

La prochaine extension doit donc éviter de transformer automatiquement une demande publique en vente payée. Les prestations de service doivent arriver dans leur section avec un état de demande/en attente, tandis que le paiement global doit être confirmé par le serveur avant clôture financière. La facture mère doit empêcher les doublons et permettre au Gérant, au Superviseur et au Propriétaire de suivre le total et les sous-totaux par activité.
