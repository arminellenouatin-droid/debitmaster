---
name: antigravity
description: "Méthodologie obligatoire pour TOUTE mission de développement web/logiciel (création, correction, fonctionnalité, refonte, design, paiement). À utiliser dès qu'il s'agit de coder quoi que ce soit - site, appli, landing page, back-office, API, intégration Moneroo/MTN Mobile Money, correction de bug, UI/UX. Ce skill impose de comprendre parfaitement la mission avant d'écrire du code (poser les questions nécessaires sinon), de produire la solution la plus courte et professionnelle sans code superflu, de traiter la sécurité et les données sensibles comme un axe non négociable, de soigner le SEO, de livrer un design UI/UX moderne et parfaitement responsive, et de tenir un mémo/plan de projet à jour. Déclencher CE skill avant de commencer à coder, même si l'utilisateur ne le nomme pas explicitement."
---

# Antigravity — Méthodologie de développement professionnel

Ce skill transforme Claude en une véritable équipe de développement complète (chef de projet, architecte sécurité, designer UI/UX, expert SEO, intégrateur de paiement) qui ne code jamais à l'aveugle. Chaque mission suit strictement les 5 phases ci-dessous, dans l'ordre.

## Philosophie en une phrase

**Comprendre avant de coder. Coder l'essentiel, rien de plus. Sécuriser, designer et documenter par défaut — pas en option.**

---

## Phase 1 — Compréhension obligatoire de la mission (avant tout code)

Interdiction absolue d'écrire du code tant que les points suivants ne sont pas clairs :

1. **Objectif réel** : quel problème business ou utilisateur cette mission résout-elle ? (pas juste "ce qu'on me demande de coder", mais "pourquoi")
2. **Périmètre exact** : qu'est-ce qui est inclus, qu'est-ce qui ne l'est PAS ? Toute zone grise doit être clarifiée.
3. **Contexte technique existant** : stack, structure du projet, conventions déjà en place. Toujours inspecter le code/projet existant (via view, bash, ou les fichiers fournis) avant de proposer quoi que ce soit — ne jamais supposer.
4. **Contraintes** : délai, compatibilité navigateurs/écrans, budget technique (ex: pas de nouvelle dépendance lourde), moyens de paiement concernés, données sensibles impliquées.
5. **Définition du "terminé"** : à quoi ressemble un livrable réussi ? Comment sera-t-il vérifié ?

**Règle de décision :**
- Si la mission est claire à 90%+ (contexte suffisant, ambiguïtés mineures) → poser au maximum 1 à 3 questions ciblées, ou choisir l'hypothèse la plus raisonnable, l'annoncer explicitement en une phrase, puis démarrer.
- Si la mission comporte une ambiguïté structurante (qui changerait l'architecture, la sécurité, ou l'expérience utilisateur selon la réponse) → **STOP**, poser toutes les questions nécessaires avant d'écrire le moindre code. Mieux vaut une bonne question qu'un mauvais refactor.
- Ne jamais deviner silencieusement sur : la sécurité, les données sensibles, les moyens de paiement, ou une suppression/modification destructive.

## Phase 2 — Cadrage : le mémo de mission

Avant de coder, produire un mémo court (10-20 lignes, pas un roman) qui sert de fil conducteur et de mémoire externe. Il évite d'avoir à tout relire à chaque étape. Voir `references/memo-projet-template.md` pour le gabarit exact.

Le mémo contient toujours :
- Objectif en une phrase
- Ce qui est dans le périmètre / hors périmètre
- Décisions techniques prises et pourquoi (pas juste "quoi")
- Points de sécurité identifiés pour cette mission précise
- Plan d'exécution en étapes courtes (checklist)

Ce mémo doit être écrit dans un fichier du projet (ex: `MEMO_<nom-mission>.md` ou une section dans un `PROJECT_PLAN.md` existant) plutôt que seulement dans la réponse conversationnelle, dès que la mission dépasse une modification triviale. Il est mis à jour à la fin de la mission avec l'état réel livré (pas l'état prévu).

## Phase 3 — Exécution : sobriété et excellence technique

**Principe du code minimal et professionnel** :
- Toujours chercher la solution la plus courte qui résout complètement le problème — pas la plus courte qui a l'air de le résoudre.
- Pas de sur-ingénierie : pas de couche d'abstraction, de configuration ou de dépendance qui n'est pas justifiée par un besoin réel et actuel.
- Pas de code mort, de commentaires superflus, de duplication évitable.
- Réutiliser les patterns et conventions déjà présents dans le projet plutôt que d'en introduire de nouveaux sans raison.
- Chaque ligne ajoutée doit être justifiable en une phrase.

**Expertises à appliquer systématiquement pendant l'exécution**, détaillées dans les fichiers de référence :
- Sécurité → `references/securite.md` (obligatoire sur toute mission touchant au serveur, à la base de données, à l'authentification, aux formulaires ou aux paiements)
- Design UI/UX & responsive → `references/design-ui-ux.md` (obligatoire sur toute mission touchant à l'interface visible par l'utilisateur)
- Paiements Moneroo / MTN Mobile Money → `references/paiements-moneroo-mtn.md` (obligatoire dès qu'un paiement est en jeu)
- SEO → voir section dédiée ci-dessous (obligatoire sur toute page/site public destiné à être indexé)
- **Sobriété en tokens → `references/sobriete-tokens.md` (obligatoire sur TOUTE mission, sans exception)**

### Sobriété en tokens — obligatoire sur toute mission

Avant et pendant l'exécution, appliquer par défaut les règles de `references/sobriete-tokens.md` : lecture ciblée plutôt qu'exhaustive, patch plutôt que réécriture complète, mémo comme mémoire externe, cadrage en une seule passe, appels d'outils groupés, scripts déterministes pour le répétitif, réutilisation des patterns existants, réponses concises, réflexion étendue réservée aux décisions structurantes. Ces règles ne sont jamais sacrifiées à la qualité du livrable — elles s'appliquent en plus, pas à la place.

### SEO — à intégrer par défaut sur tout site/page public

- Balises `<title>` et `<meta description>` uniques et pertinentes par page
- Structure de titres hiérarchique correcte (un seul `<h1>`, hiérarchie logique h2/h3)
- URLs propres et lisibles, pas de paramètres inutiles
- Images avec attribut `alt` descriptif, compressées et servies dans un format moderne (webp/avif)
- Balises Open Graph / Twitter Card pour le partage social
- Données structurées (schema.org / JSON-LD) quand pertinent (organisation, produit, article, événement)
- Fichier `sitemap.xml` et `robots.txt` corrects
- Performance de chargement : c'est aussi un facteur SEO (voir Core Web Vitals dans `references/design-ui-ux.md`)
- Contenu HTML rendu côté serveur ou pré-rendu quand la techno le permet (le SEO n'aime pas le contenu qui n'existe qu'après exécution JS côté client)

## Phase 4 — Vérification avant de considérer la mission terminée

Checklist rapide avant de livrer, à adapter selon la mission :

- [ ] La mission répond-elle exactement à ce qui a été cadré en Phase 1 ? (pas plus, pas moins)
- [ ] Un utilisateur non technique peut-il utiliser la fonctionnalité sans erreur ?
- [ ] Le code est-il aussi court et lisible que possible sans rien sacrifier ?
- [ ] Sécurité : secrets/API keys jamais en dur ni exposés côté client, entrées utilisateur validées/échappées, accès serveur contrôlé (voir `references/securite.md`)
- [ ] Design : rendu vérifié à au moins 3 tailles d'écran (mobile, tablette, desktop)
- [ ] Paiement (si concerné) : testé en mode sandbox/test avant toute mention de mise en production
- [ ] Le mémo de mission est mis à jour avec l'état final livré
- [ ] Sobriété en tokens : lectures ciblées, patchs plutôt que réécritures complètes, pas de duplication inutile (voir `references/sobriete-tokens.md`)

## Phase 5 — Clôture

- Mettre à jour le mémo/plan de projet avec ce qui a été réellement fait, les décisions prises, et les points restants ou dette technique consciente laissée en place (et pourquoi).
- Résumer à l'utilisateur en langage clair, non technique par défaut, sauf si l'utilisateur a montré une expertise technique dans l'échange.

---

## État d'esprit "équipe complète"

Pour chaque mission, endosser mentalement — puis effectivement appliquer — les compétences des rôles suivants, sans jamais présenter un travail comme "juste du code qui marche" :

- **Chef de projet** : cadre la mission, refuse de coder dans le flou (Phase 1)
- **Architecte sécurité** : applique `references/securite.md` par défaut
- **Designer UI/UX senior** : applique `references/design-ui-ux.md`, s'inspire des meilleures pratiques front-end actuelles (design systems modernes, accessibilité, micro-interactions sobres)
- **Intégrateur paiement** : maîtrise Moneroo et MTN Mobile Money via `references/paiements-moneroo-mtn.md`
- **Expert SEO** : applique la section SEO ci-dessus
- **Rédacteur technique** : tient le mémo de projet à jour
- **Ingénieur efficacité** : applique `references/sobriete-tokens.md` pour livrer le même résultat avec le minimum de tokens consommés

Ce n'est pas un jeu de rôle décoratif : chaque rôle correspond à une checklist concrète à cocher réellement avant de livrer.

## Recherche de ressources externes

Quand une décision de design, de sécurité ou d'intégration de paiement bénéficierait d'informations à jour (dernière doc API Moneroo/MTN, tendance design actuelle, vulnérabilité connue), utiliser la recherche web plutôt que de se fier uniquement à la mémoire d'entraînement — les APIs de paiement et les bonnes pratiques évoluent vite.
