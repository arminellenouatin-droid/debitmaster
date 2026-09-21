# Mémo - Refonte réversible de la landing page

Objectif : rendre la page d’accueil de DebitManager plus lisible, professionnelle et responsive, sans modifier les parcours métier.

Mode : redesign preserve. L’identité vert profond / ambre, les routes et les CTA existants sont conservés ; la hiérarchie visuelle et la composition du hero évoluent.

Dans le périmètre : navigation, hero, aperçu du tableau de bord, bandeau de bénéfices, section de valeur, CTA final, responsive mobile/tablette/desktop, SEO de la page.
Hors périmètre : authentification, affiliation, dashboard, paiements, API, base de données.

Contrats protégés : routes `/`, `/inscription`, `/connexion`, `/affiliation`, libellés et destinations des CTA, aucun secret ni donnée utilisateur.

Direction : interface éditoriale opérationnelle, fond ivoire, vert profond, ambre réservé aux accents ; densité aérée ; aperçu produit visuel ; aucun effet gratuit.

Rollback : l’ancien `src/app/page.tsx` reste accessible dans Git via le commit parent `9e36b77`. La refonte est livrée sur une branche et un commit séparés ; un revert suffit pour revenir à la version précédente.

Plan :
- [x] Synchroniser main et créer la branche dédiée.
- [x] Auditer l’ancienne page et la maquette validée.
- [x] Implémenter la page d’accueil.
- [x] Vérifier typecheck, build et rendu responsive à 375, 768 et 1440 px.
- [ ] Déployer via pull request puis documenter le commit de retour.

État : implémentation validée localement, prête à être publiée.
Contrôle visuel intermédiaire : la composition desktop et l’empilement mobile sont corrects, sans débordement visible. Un défaut de contraste a été repéré sur les CTA verts : leur texte apparaît trop sombre sur le rendu local malgré la classe claire. Correction à appliquer avant publication : forcer une couleur de texte ivoire explicite sur les CTA verts.
Contrôle visuel final desktop/mobile : contraste des CTA corrigé, texte ivoire lisible sur fond vert, hero stable, aucune coupure visible et empilement mobile cohérent. La vue tablette doit conserver la navigation simplifiée à 768 px.
