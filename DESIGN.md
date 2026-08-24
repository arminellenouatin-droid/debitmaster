# DebitManager — Direction visuelle produit

## Registre

DebitManager est un produit métier. Le design sert la compréhension, la rapidité opérationnelle et la confiance dans les chiffres.

## Scène de référence

Un gérant consulte son tableau de bord sur un ordinateur portable dans l’arrière-salle lumineuse de son établissement, entre deux services, avec peu de temps et des décisions concrètes à prendre.

## Mouvement choisi

**Modernisme éditorial africain fonctionnel** : une interface structurée par la hiérarchie typographique et des repères de signalétique, avec une chaleur visuelle inspirée des enseignes et menus de quartier sans tomber dans le décoratif.

## Principes

La surface doit rester lumineuse et respirable. Les données importantes sont hiérarchisées avant d’être décorées. Les actions sont regroupées par intention métier, jamais par technologie. Les états sont explicites, notamment pour les paiements, le stock, les erreurs et les permissions.

## Palette et typographie

Les tokens seront définis en OKLCH dans la feuille globale. La base utilise un ivoire chaud, un graphite légèrement teinté et un rouge brique comme accent de marque. Le rouge signale l’action ou l’attention, il ne recouvre pas toute l’interface. Les titres utilisent une serif contemporaine pour les repères éditoriaux ; les données, formulaires et commandes utilisent une sans-serif nette. Le corps est limité à environ 70 caractères par ligne.

## Structure

Le tableau de bord utilise une navigation latérale persistante sur desktop et un accès compact sur mobile. La page d’accueil n’est pas un mur de cartes : elle commence par un résumé opérationnel, puis déroule les tâches prioritaires et les alertes dans un ordre d’action. Les écrans de commande privilégient les colonnes de statut et les actions accessibles au pouce.

## Interaction et motion

Les transitions restent brèves, sous 250 ms, et servent à confirmer une action ou situer un changement d’état. Les formulaires affichent leurs erreurs près du champ concerné et les opérations critiques donnent un état de chargement explicite. Toutes les animations respectent `prefers-reduced-motion`.

## Accessibilité

Les contrastes, le focus clavier, les libellés de formulaires, les états vides et les alternatives textuelles sont des critères de sortie. Aucun statut ne repose uniquement sur la couleur.
