# Mémo — Sélecteur de produits réversible

## Objectif
Réduire la densité de l’écran « Prendre une commande » en masquant le catalogue jusqu’à l’activation de la recherche ou de la sélection.

## Fonctionnement livré
La serveuse choisit Boissons ou Repas, puis utilise un champ de recherche unique. La liste correspondante apparaît au focus ou pendant la saisie et se referme après sélection. Les boissons sont ajoutées directement au panier.

Après la sélection d’un repas, un sélecteur d’accompagnement apparaît avant l’ajout. Les options existantes sont conservées, y compris « Aucun ». Chaque variante d’un même repas peut conserver son propre accompagnement dans le panier.

## Réversibilité
Le développement est isolé sur la branche `feat/reversible-product-picker`. La branche `backup/order-product-picker-before-change` pointe vers la version précédente. La branche `main` et la production ne sont pas modifiées par cette livraison.

## Vérification
Typecheck et build réussis. Le diff est limité au composant de prise de commande. Le commit de travail peut être testé avant intégration, ou abandonné par retour sur `main`.
