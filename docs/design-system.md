# Design System — DebitManager

**Objectif du document :** figer les tokens de design (couleurs, typographie, espacements, composants, iconographie) afin que le rendu soit strictement cohérent entre mobile (Flutter) et web (React), et que chaque agent frontend parte des mêmes valeurs plutôt que d'en inventer.

**Principes directeurs (rappel du cahier des charges) :** interface pensée pour des utilisateurs peu ou pas lettrés — icônes explicites, couleurs sémantiques fortes, confirmations sonores/vibratoires, minimum de texte, gros boutons tactiles, peu de niveaux de menu, mode sombre et clair, accessibilité (contraste élevé, taille de police ajustable).

## 1. Couleurs (tokens)

### 1.1 Couleurs sémantiques (identiques en mode clair et sombre, ajustées en luminosité)

| Token | Usage | Valeur (clair) | Valeur (sombre) |
|---|---|---|---|
| `color.success` | Validé, paiement réussi, présence à l'heure | `#1E8E3E` | `#3DDC84` |
| `color.warning` | Attention, seuil d'alerte, retard | `#F59E0B` | `#FBBF24` |
| `color.danger` | Erreur, alerte critique, absence, échec | `#DC2626` | `#F87171` |
| `color.info` | Information neutre, en attente | `#2563EB` | `#60A5FA` |

### 1.2 Couleurs de marque

| Token | Usage | Valeur |
|---|---|---|
| `color.primary` | Couleur principale de la marque, boutons d'action principaux | `#0F4C3A` (vert profond) |
| `color.primary.light` | Variante claire (survol, fond léger) | `#E8F3EE` |
| `color.secondary` | Accent secondaire (liens, éléments actifs) | `#D9A441` (or/ambre) |

### 1.3 Neutres

| Token | Usage | Valeur (clair) | Valeur (sombre) |
|---|---|---|---|
| `color.background` | Fond principal | `#FFFFFF` | `#0E1512` |
| `color.surface` | Cartes, panneaux | `#F7F8F7` | `#182420` |
| `color.border` | Séparateurs, contours | `#E2E4E2` | `#2A3833` |
| `color.text.primary` | Texte principal | `#111827` | `#F3F4F2` |
| `color.text.secondary` | Texte secondaire, labels | `#6B7280` | `#9CA69F` |
| `color.text.disabled` | Texte désactivé | `#B0B4B0` | `#4B5750` |

### 1.4 Statuts métier (mapping direct vers les ENUM du modèle de données)

| Statut | Couleur token |
|---|---|
| `ACTIVE` / `ON_TIME` / `READY` / `SUCCESS` / `VALIDATED` | `color.success` |
| `GRACE_PERIOD` / `LATE` / `PENDING` / `PENDING_VALIDATION` | `color.warning` |
| `SUSPENDED` / `EXPIRED` / `ABSENT` / `FAILED` / `REJECTED` / `CANCELLED` | `color.danger` |
| `TRIAL` / `DRAFT` / `IN_PREPARATION` | `color.info` |

**Règle d'accessibilité :** chaque statut doit toujours être accompagné d'une icône et/ou d'un libellé court — jamais de la couleur seule (daltonisme).

## 2. Typographie

- **Police principale :** Inter (ou Noto Sans en fallback pour meilleure couverture des caractères locaux) — lisible à petite taille, bonne prise en charge multilingue
- **Police monospace (chiffres/montants) :** utiliser des chiffres tabulaires (`font-variant-numeric: tabular-nums`) pour l'alignement des montants dans les tableaux

| Token | Taille | Poids | Usage |
|---|---|---|---|
| `type.display` | 32px | Bold (700) | Montants clés du dashboard (CA, solde) |
| `type.h1` | 24px | Bold (700) | Titres d'écran |
| `type.h2` | 20px | SemiBold (600) | Titres de section |
| `type.h3` | 17px | SemiBold (600) | Titres de carte |
| `type.body` | 15px | Regular (400) | Texte courant |
| `type.body.strong` | 15px | SemiBold (600) | Texte mis en avant |
| `type.caption` | 13px | Regular (400) | Labels, légendes, métadonnées |
| `type.button` | 16px | SemiBold (600) | Texte des boutons (gros et lisible) |

**Taille de police ajustable :** l'utilisateur peut augmenter l'échelle globale de +20%/+40% depuis les paramètres d'accessibilité ; tous les tokens `type.*` doivent être définis en unités relatives (`rem`/`sp`), jamais en valeurs figées non ajustables.

## 3. Espacements et grille

| Token | Valeur | Usage |
|---|---|---|
| `space.xs` | 4px | Espacement interne minimal (icône + texte) |
| `space.sm` | 8px | Espacement entre éléments proches |
| `space.md` | 16px | Espacement standard entre blocs |
| `space.lg` | 24px | Séparation entre sections |
| `space.xl` | 32px | Marges d'écran |
| `space.xxl` | 48px | Séparation de grands blocs (dashboard) |

- **Zone tactile minimale :** 48×48px pour tout élément cliquable (boutons, icônes d'action), conformément aux exigences d'accessibilité tactile
- **Grille :** 4px comme unité de base, tous les espacements sont des multiples de 4px

## 4. Rayons, élévation, iconographie

| Token | Valeur | Usage |
|---|---|---|
| `radius.sm` | 6px | Champs de formulaire, petits badges |
| `radius.md` | 12px | Cartes, boutons |
| `radius.lg` | 20px | Modales, feuilles bottom-sheet |
| `elevation.card` | ombre légère (0 1px 3px rgba(0,0,0,0.08)) | Cartes sur fond `surface` |
| `elevation.modal` | ombre marquée (0 8px 24px rgba(0,0,0,0.16)) | Modales, popups |

**Iconographie :**
- Style : icônes en traits pleins (filled), lisibles à petite taille, jamais de contour fin seul
- Une action = une icône constante dans toute l'application (ex. toujours la même icône « ajouter au stock », jamais deux variantes différentes pour la même action)
- Taille standard : 24px (petites icônes inline), 32px (icônes de navigation/action principale), 64px (icônes d'état plein écran : succès paiement, erreur de synchronisation)
- Bibliothèque recommandée : set d'icônes cohérent unique (ex. Material Symbols ou Phosphor Icons), jamais de mélange de styles entre écrans

## 5. Composants

### 5.1 Boutons
- **Primaire** : fond `color.primary`, texte blanc, `radius.md`, hauteur minimale 48px — action principale de l'écran (une seule par écran)
- **Secondaire** : contour `color.primary`, fond transparent, texte `color.primary`
- **Danger** : fond `color.danger`, réservé aux actions destructives (annulation, suppression, retrait de fonds) — toujours accompagné d'une confirmation
- **Désactivé** : fond `color.text.disabled`, non cliquable, jamais simplement grisé sans étiquette explicative si l'action est invisible pour raison de permission (dans ce cas : ne pas afficher le bouton du tout)

### 5.2 Cartes (Cards)
- Fond `color.surface`, `radius.md`, `elevation.card`
- Utilisées pour : fiche produit, fiche employé, ligne de KPI, carte de commande sur le tableau de bord cuisine/bar

### 5.3 Badges de statut
- Pastille colorée (token de statut, section 1.4) + icône + libellé court (ex. « ● En retard »)
- Jamais de badge composé uniquement d'une couleur sans texte/icône

### 5.4 Formulaires
- Champs à hauteur minimale 48px, label toujours visible au-dessus du champ (jamais uniquement en placeholder)
- Validation en temps réel avec message d'erreur explicite sous le champ concerné, icône d'erreur `color.danger`
- Claviers contextuels adaptés (numérique pour montants/téléphone, etc.)

### 5.5 Tableaux de bord et graphiques
- Montant clé toujours en `type.display` avec unité monétaire explicite
- Graphiques en courbes/barres avec code couleur sémantique cohérent (jamais de couleur arbitraire pour un KPI financier positif/négatif)
- Export toujours accessible via une icône clairement identifiable en en-tête de tableau

### 5.6 Navigation
- Navigation par onglets en bas d'écran sur mobile (3 à 5 items maximum, icône + libellé court)
- Menu latéral sur web/tablette pour les dashboards (Administrateur, Comptable, Super-Admin)
- Jamais plus de 2 niveaux de profondeur pour atteindre une fonctionnalité courante

### 5.7 Indicateur de connexion (hors-ligne/synchronisation)
- Bandeau persistant en haut d'écran : vert « En ligne », orange « Synchronisation en cours », rouge « Hors-ligne » avec icône dédiée
- Ne bloque jamais l'écran, reste visible et compact

### 5.8 Confirmations sonores/vibratoires
- Son + vibration courte de confirmation sur : validation de paiement, badgeage réussi, commande marquée prête
- Son + vibration distincte (plus longue, tonalité différente) sur : erreur, refus de connexion, échec de paiement

## 6. Mode sombre / mode clair

- Bascule manuelle disponible dans les paramètres + détection automatique du thème système par défaut
- Tous les tokens de couleur sont doublés (valeur clair/sombre, voir section 1) ; aucune couleur ne doit être codée en dur dans les composants, uniquement via les tokens

## 7. Livrables design attendus

1. Logo DebitManager : SVG + PNG multi-résolutions, versions couleur/monochrome/fond transparent
2. Fichier de tokens design exporté (JSON ou variables CSS/Dart) consommable par le web et le mobile depuis une source unique
3. Bibliothèque de composants Figma (ou équivalent) couvrant tous les composants de la section 5
4. Maquettes haute-fidélité des écrans clés : onboarding, prise de commande, KDS bar/cuisine, dashboard exploitant, dashboard Super-Admin, espace affilié
5. Favicon et icônes d'application (toutes résolutions iOS/Android)

---

*Ce document est la source de vérité visuelle du produit. Toute valeur de couleur, taille ou espacement utilisée dans le code doit provenir d'un token défini ici — aucune valeur codée en dur dans les composants.*
