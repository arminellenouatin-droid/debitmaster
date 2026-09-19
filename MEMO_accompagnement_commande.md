# Mémo — Accompagnement des repas côté serveur

Objectif : permettre à la serveuse de choisir un accompagnement pour chaque repas avant l’envoi de la commande.

Périmètre : écran de prise de commande du rôle SERVEUR, stockage de l’accompagnement sur la ligne de commande, affichage côté cuisine.
Hors périmètre : boissons, tarification, catalogue, paiement, workflow de commande et autres établissements.

Décision : ajouter une valeur texte contrôlée (`Aucun` ou un accompagnement prédéfini) à chaque ligne de repas ; ne pas changer le prix.
Sécurité : valider côté API que l’accompagnement est autorisé et que seuls les repas peuvent en recevoir un.
UX : afficher le sélecteur après la quantité dans chaque ligne du brouillon ; la valeur par défaut est `Aucun`.

Plan :
- [x] Auditer le formulaire serveur et l’API des commandes.
- [x] Ajouter la migration additive et la validation API.
- [x] Ajouter le sélecteur au panier serveur.
- [x] Afficher l’accompagnement dans l’écran cuisine et sur le ticket serveur.
- [x] Compiler, tester et vérifier le diff.

État : livré sur la branche de fonctionnalité ; migration appliquée à Supabase Débit Master. Liste contrôlée : Aucun, Riz, Pâte, Frites, Attiéké, Salade composée, Alloco.
