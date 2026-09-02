# Menu client QR, BAR SANTE PLUS

## Design read

Je lis cette demande comme une expérience de commande publique mobile-first pour des clients assis à une table, dans un établissement faiblement éclairé le soir, avec une esthétique lounge chaleureuse, éditoriale et orientée vers une action immédiate.

## Référence maîtresse

Le HTML fourni par l’utilisateur est la référence visuelle de départ : thème sombre, accent ambre, typographies Manrope et Plus Jakarta Sans, bandeau d’accueil, en-tête fixe, héros immersif, sections horizontales, panier persistant et accès direct au parcours de commande. Les contenus fictifs, les liens d’images externes et les boutons statiques seront remplacés par les produits et les actions réelles de BAR SANTE PLUS.

## Dials

La variance de composition est de 7/10 afin de conserver une navigation mobile vivante sans sacrifier la lisibilité. L’intensité de mouvement est de 4/10, limitée aux transitions d’ajout au panier, à l’ouverture du panier et au rafraîchissement des états de commande. La densité visuelle est de 6/10, car le client doit parcourir plusieurs familles de produits tout en gardant le total visible.

## Principes d’expérience

Le menu doit fonctionner sans compte client. Le QR encode un jeton public opaque lié à un établissement et à une table, jamais un identifiant privé exploitable seul. La table issue du QR est préremplie et verrouillée pour éviter les commandes sur la mauvaise table. Le client peut choisir des boissons et des repas dans un même panier, mais le serveur sépare les unités de préparation côté gérant et côté chef cuisine. Le paiement est proposé après récapitulatif, avec un état explicite si le paiement mobile est en attente.

## Palette et typographie

La scène sombre est justifiée par un client qui scanne son QR en salle ou le soir : le fond graphite réduit l’éblouissement et l’ambre guide l’action. Les surfaces utilisent un graphite chaud, l’ivoire sert aux textes principaux et l’ambre est réservé aux actions, prix et focus. Plus Jakarta Sans porte les titres et Manrope porte les textes, prix et contrôles. Aucun texte ne doit reposer uniquement sur la couleur.

## Architecture de page

La page s’ouvre sur le nom de l’établissement, le contexte de table et une proposition de valeur courte. Les catégories sont accessibles par défilement horizontal. Les produits sont présentés sous forme de listes compactes et de cartes visuelles seulement lorsque l’image apporte une information réelle. Le panier est un tiroir mobile et une colonne latérale desktop, avec le montant et le bouton principal toujours identifiables.

## États obligatoires

Prévoir les états chargement, catalogue vide, produit indisponible, panier vide, ligne ajoutée, erreur réseau, commande envoyée, paiement en attente, paiement confirmé et commande refusée. Tous les boutons doivent avoir un focus visible, une cible tactile d’au moins 44 pixels et un libellé verbe-objet.

## Contraintes métier

Une commande publique doit être rattachée au tenant du jeton et à la table du jeton côté serveur. Le serveur ne doit jamais faire confiance au prix, à la catégorie, au tenant ou à la table envoyés par le navigateur. Les prix et les unités de préparation sont relus côté serveur. Une commande contenant des boissons est visible par le gérant, une commande contenant des repas est visible par le chef cuisine, et une commande mixte est ventilée vers les deux flux sans dupliquer la facture.

## Question financière à sécuriser

Le paiement public doit réutiliser le mécanisme de paiement déjà validé dans DebitManager. Si le fournisseur mobile ne permet pas de confirmer un paiement sans numéro de téléphone client ou devise compatible, l’interface doit afficher une attente contrôlée et ne jamais marquer la commande comme payée avant confirmation serveur.
