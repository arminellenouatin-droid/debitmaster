# Design UI/UX — expertise front-end de haut niveau

Objectif : produire des interfaces qui ont l'air conçues par une agence de design premium, pas des templates génériques. Consulter aussi le skill `frontend-design` s'il est disponible dans la session pour les contraintes techniques précises (tokens CSS, styling) de l'environnement d'exécution — ce fichier donne la direction, `frontend-design` donne l'exécution technique.

## Principes de base
- Jamais de design "par défaut" ou qui ressemble à un template Bootstrap non personnalisé : choisir une direction artistique délibérée (typographie, palette, ton) cohérente avec l'identité du projet.
- Hiérarchie visuelle claire : la chose la plus importante de l'écran doit sauter aux yeux en premier, sans effort.
- Cohérence systématique : espacements, rayons de bordure, ombres, couleurs et typographies suivent une échelle définie une fois puis réutilisée partout (mini design system), jamais des valeurs magiques improvisées à chaque composant.
- Micro-interactions sobres et utiles (transitions, hover, focus) — jamais gratuites ou qui ralentissent l'usage.

## Responsive — obligatoire sur tout livrable visuel
- Toujours concevoir mobile-first, puis vérifier à 3 points de rupture minimum : mobile (~375px), tablette (~768px), desktop (~1440px).
- Aucun débordement horizontal, aucun texte tronqué, aucun bouton inatteignable au doigt sur mobile (cible tactile ≥ 44px).
- Images et médias responsives (dimensionnement adaptatif, formats modernes, lazy loading).
- Navigation adaptée : menu mobile pensé spécifiquement, pas juste un menu desktop rétréci.

## Accessibilité (fait partie du professionnalisme, pas une option)
- Contraste de couleurs suffisant (respecter les seuils WCAG AA au minimum).
- Zones interactives navigables au clavier, focus visible.
- Attributs `alt`, labels de formulaire, structure sémantique HTML correcte (pas des `<div>` partout où un élément sémantique existe).

## Performance perçue et réelle (Core Web Vitals)
- Optimiser le chargement des polices, images et scripts pour un rendu rapide du contenu visible (LCP faible).
- Éviter les décalages de mise en page pendant le chargement (CLS faible — toujours réserver l'espace des images/médias).
- Interactivité rapide (INP faible) : éviter le JS bloquant inutile.

## Méthode de travail
1. Clarifier le ton recherché (ex: institutionnel/corporate, festif/événementiel, premium/luxe, simple/utilitaire) — ne jamais choisir un style au hasard.
2. Définir en 2-3 phrases la direction visuelle avant de coder (typographie principale, palette, ambiance).
3. Construire les composants réutilisables avant les pages spécifiques.
4. Vérifier le rendu réel à chaque point de rupture avant de considérer l'écran terminé.

## S'appuyer sur les meilleures pratiques actuelles
Les tendances et bibliothèques front-end évoluent vite. Quand un choix de design system, de composant ou de librairie visuelle bénéficierait d'une vérification des pratiques actuelles, faire une recherche web ciblée plutôt que de se fier uniquement à des références datées.
