# Parcours utilisateurs (User Flows) — DebitManager

**Objectif du document :** fournir les diagrammes de flux de référence pour les parcours critiques du produit, afin que tous les agents développent le même enchaînement d'écrans et de règles, sans divergence d'interprétation. Chaque diagramme est en syntaxe Mermaid (flowchart), directement rendable dans un IDE ou une documentation compatible.

## 1. INSCRIPTION EXPLOITANT → ACTIVATION ABONNEMENT → CONFIGURATION BOUTIQUE

```mermaid
flowchart TD
    A[Début : formulaire d'inscription] --> B[Téléphone + nom + prénom + email\nou connexion sociale]
    B --> C[Vérification OTP par SMS]
    C --> D{Choix du parcours}
    D -->|Créer une boutique| E[Choix du type d'activité\nBuvette / Bar-restaurant / Boîte de nuit-Lounge]
    E --> F[Saisie infos entreprise\nnom, adresse, logo, pays]
    F --> G[Génération automatique du code société unique]
    G --> H{Code affilié saisi ?}
    H -->|Oui| I[Rattachement ReferralTracking → Affiliate]
    H -->|Non| J[Pas d'affilié rattaché]
    I --> K
    J --> K[Choix de la formule d'abonnement]
    K --> L{Première inscription ?}
    L -->|Oui| M[Proposition essai gratuit 14 jours\nsans carte obligatoire]
    L -->|Non| N[Paiement requis immédiatement]
    M --> O[Accès dashboard en mode essai]
    N --> P[Paiement via Kkiapay / Moneroo / Cinetpay]
    P --> Q{Paiement confirmé ?}
    Q -->|Non| R[Message d'échec + nouvelle tentative]
    R --> P
    Q -->|Oui| S[Abonnement activé - statut ACTIVE]
    O --> T[Déblocage dashboard configuration]
    S --> T
    T --> U[Configuration personnel, plannings, stocks/prix, tables]
    U --> V[Fin : boutique opérationnelle]
```

## 2. INSCRIPTION EMPLOYÉ → VALIDATION → PREMIER ACCÈS

```mermaid
flowchart TD
    A[Début] --> B{Mode d'entrée}
    B -->|Auto-inscription| C[Saisie du code société]
    C --> D[Message : inscription en attente de validation]
    D --> E[Alerte temps réel à l'Administrateur/Promoteur]
    E --> F{Décision admin}
    F -->|Rejeté| G[Notification de rejet à l'employé - Fin]
    F -->|Validé| H[Attribution du rôle et des droits]
    H --> I[Génération mot de passe temporaire\nenvoyé par email/SMS]
    B -->|Création directe par l'admin| I
    I --> J[Connexion de l'employé]
    J --> K{Compte boutique actif ?}
    K -->|Non| L[Accès bloqué - message d'indisponibilité]
    K -->|Oui| M[Changement de mot de passe temporaire imposé]
    M --> N[Accès à l'espace de travail\ngénéré selon ses droits]
    N --> O[Fin : premier accès complété]
```

## 3. PRISE DE COMMANDE → PRÉPARATION → LIVRAISON → PAIEMENT → FACTURE

```mermaid
flowchart TD
    A[Début : serveur ouvre l'app] --> B{Connexion internet ?}
    B -->|Non| C[Prise de commande en mode hors-ligne\nstockage local]
    B -->|Oui| D[Prise de commande en ligne]
    C --> E[Commande mise en file d'attente de synchronisation]
    D --> F[Ventilation automatique par section\nBar / Cuisine]
    E -->|Reconnexion| F
    F --> G[Barman/Chef cuisine reçoit la commande]
    G --> H[Attribution à un exécutant disponible]
    H --> I[Préparation en cours]
    I --> J[Bouton Commande prête]
    J --> K[Notification automatique au serveur]
    K --> L[Serveur retire la commande]
    L --> M[Validation Commande reçue]
    M --> N[Livraison au client]
    N --> O[Présentation de la facture\nécran / email / impression thermique]
    O --> P{Mode de paiement}
    P -->|Espèces| Q[Validation manuelle par le serveur]
    P -->|Mobile money| R[Saisie numéro client → demande de validation\n→ confirmation]
    P -->|Carte| S[Lien de paiement sécurisé agrégateur\n→ validation]
    Q --> T[Facture PDF générée + numéro légal séquentiel]
    R --> T
    S --> T
    T --> U{Split billing demandé ?}
    U -->|Oui| V[Division entre convives/modes de paiement]
    U -->|Non| W[Facture unique]
    V --> X[Fin : commande clôturée]
    W --> X
```

## 4. BADGEAGE PRÉSENCE AVEC CONTRAINTE DE GÉOLOCALISATION

```mermaid
flowchart TD
    A[Début : employé se connecte à l'app] --> B[Capture de la position GPS du téléphone]
    B --> C{Position dans le rayon autorisé\nautour du lieu de travail ?}
    C -->|Oui| D[Badgeage automatique validé]
    C -->|Non| E[Connexion refusée]
    E --> F{Exception accordée par un superviseur ?}
    F -->|Oui| D
    F -->|Non| G[Fin : accès bloqué]
    D --> H{Heure de connexion vs planning}
    H -->|À l'heure| I[Statut : à l'heure]
    H -->|Retard ≤ 10 min| I
    H -->|Retard 10-30 min| J[Statut : en retard]
    H -->|Retard > 30 min| K[Connexion bloquée\nnécessite autorisation superviseur]
    K --> L{Autorisation accordée ?}
    L -->|Oui| J
    L -->|Non| M[Statut : absent pour la journée]
    I --> N[Session de travail active]
    J --> N
    N --> O{Changement de localisation\nau-delà du temps défini ?}
    O -->|Oui, sans exception| P[Déconnexion automatique]
    O -->|Non| Q[Session poursuivie]
    Q --> R[Fin de service : check-out]
    P --> S[Fin : entrée journalisée dans Attendance]
    R --> S
    M --> S
```

## 5. ALERTE STOCK → BON DE COMMANDE → VALIDATION → RÉCEPTION MARCHANDISE → MISE À JOUR STOCK

```mermaid
flowchart TD
    A[Stock d'un produit atteint le seuil d'alerte] --> B[Notification automatique\nchargé approvisionnement + comptable + exploitant]
    B --> C[Chargé d'approvisionnement sélectionne les produits à commander]
    C --> D[Génération du bon de commande\nfournisseur + quantités]
    D --> E{Validation requise}
    E -->|Comptable ou Promoteur| F{Décision}
    F -->|Rejeté| G[Retour au chargé d'approvisionnement\navec motif]
    G --> C
    F -->|Validé| H[Commande envoyée au fournisseur]
    H --> I[Attente de livraison]
    I --> J[Réception de la marchandise]
    J --> K[Saisie des quantités reçues\npar le magasinier/chargé approvisionnement]
    K --> L{Écart quantité commandée vs reçue ?}
    L -->|Oui| M[Signalement de l'écart]
    L -->|Non| N[Réception conforme]
    M --> O[Mise à jour du stock avec quantités réelles]
    N --> O
    O --> P[StockMovement IN_PURCHASE enregistré]
    P --> Q[Fin : stock mis à jour]
```

## 6. PRÉPARATION ET VALIDATION DE LA PAIE MENSUELLE

```mermaid
flowchart TD
    A[Début de période de paie] --> B[Comptable prépare la paie par employé\nsalaire de base]
    B --> C[Ajout primes automatiques suggérées\nmeilleur vendeur, assiduité, zéro écart]
    C --> D[Ajout retenues éventuelles]
    D --> E[Calcul du montant total par employé]
    E --> F[Soumission au Promoteur pour validation]
    F --> G{Validation}
    G -->|Rejeté| H[Retour au comptable avec motif]
    H --> B
    G -->|Validé| I[Statut paie : VALIDATED]
    I --> J[Paiement mobile money / virement bancaire]
    J --> K{Paiement confirmé ?}
    K -->|Non| L[Nouvelle tentative de paiement]
    L --> J
    K -->|Oui| M[Notification envoyée à l'employé]
    M --> N[Génération du bulletin de salaire PDF]
    N --> O[Fin : historique de paie mis à jour]
```

## 7. INVENTAIRE PHYSIQUE → CALCUL DES ÉCARTS → RAPPORT

```mermaid
flowchart TD
    A[Déclenchement de l'inventaire\nfréquence configurable] --> B[Magasinier/Superviseur démarre l'inventaire]
    B --> C[Saisie des quantités réelles\nproduit par produit]
    C --> D[Le système compare quantité théorique vs réelle]
    D --> E{Écart détecté ?}
    E -->|Non| F[Statut : OK]
    E -->|Oui| G[Calcul de l'écart\npositif ou négatif]
    G --> H[Interprétation automatique\nperte probable / vol probable / erreur de saisie]
    F --> I[Génération du rapport d'inventaire]
    H --> I
    I --> J[Notification à l'exploitant/comptable]
    J --> K[Fin : rapport consultable et exportable]
```

## 8. RENOUVELLEMENT/EXPIRATION D'ABONNEMENT → PÉRIODE DE GRÂCE → SUSPENSION

```mermaid
flowchart TD
    A[Abonnement actif] --> B[Rappel automatique J-7]
    B --> C[Rappel automatique J-3]
    C --> D[Rappel automatique J-1]
    D --> E{Renouvellement effectué avant expiration ?}
    E -->|Oui| F[Nouvel abonnement activé\nhistorique de paiement mis à jour]
    F --> A
    E -->|Non| G[Date d'expiration atteinte]
    G --> H[Statut : GRACE_PERIOD 3 jours\naccès lecture seule, pas de nouvelles commandes]
    H --> I{Paiement effectué pendant la grâce ?}
    I -->|Oui| F
    I -->|Non| J[Statut : SUSPENDED]
    J --> K[Notification à l'exploitant]
    K --> L{Réabonnement ultérieur ?}
    L -->|Oui| M[Réactivation complète du compte]
    L -->|Non| N[Compte reste suspendu - Fin]
    M --> A
```

## 9. INSCRIPTION AFFILIÉ → VALIDATION → PARTAGE DU LIEN → BOUTIQUE PARRAINÉE → COMMISSION → RETRAIT

```mermaid
flowchart TD
    A[Début : formulaire public d'inscription affilié] --> B[Nom, téléphone, email,\ncoordonnées de paiement]
    B --> C[Acceptation CGU d'affiliation]
    C --> D{Mode de validation configuré}
    D -->|Automatique| E[Compte affilié actif immédiatement]
    D -->|Manuelle| F[Revue par le Super-Admin]
    F --> G{Décision}
    G -->|Rejeté| H[Fin : inscription rejetée]
    G -->|Validé| E
    E --> I[Génération code + lien de parrainage unique]
    I --> J[Affilié partage le lien\nréseaux sociaux, site, WhatsApp]
    J --> K[Un prospect clique sur le lien]
    K --> L[ReferralTracking créé\ntracking_token + expiration]
    L --> M{Inscription boutique avant expiration du tracking ?}
    M -->|Non| N[Tracking expiré - pas d'attribution]
    M -->|Oui| O[Boutique rattachée définitivement à l'affilié]
    O --> P[Boutique paie son premier abonnement]
    P --> Q[AffiliateCommission créée - statut PENDING]
    Q --> R[Délai de sécurité anti-remboursement]
    R --> S{Remboursement pendant le délai ?}
    S -->|Oui| T[Commission rejetée]
    S -->|Non| U[Commission validée - disponible]
    U --> V{Mode de commission}
    V -->|Premier paiement uniquement| W[Pas de commission sur renouvellements]
    V -->|Récurrent| X[Nouvelle commission à chaque renouvellement\ntant que boutique active]
    U --> Y[Affilié consulte son solde disponible]
    Y --> Z{Seuil minimum de retrait atteint ?}
    Z -->|Non| Y
    Z -->|Oui| AA[Demande de retrait]
    AA --> AB[Traitement par le Super-Admin]
    AB --> AC[Versement mobile money/virement]
    AC --> AD[Fin : historique de versement mis à jour]
```

---

*Ces diagrammes constituent la référence fonctionnelle des parcours critiques. Tout écart d'implémentation par rapport à ces flux doit être justifié et documenté avant mise en production.*
