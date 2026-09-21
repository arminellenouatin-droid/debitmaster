# RÈGLES DE SÉCURITÉ OBLIGATOIRES : À RESPECTER PAR TOUT AGENT IA

> À copier dans `AGENTS.md` (ou `CLAUDE.md`) à la racine de chaque projet.
> Ces règles s'appliquent à **chaque ligne de code, chaque migration, chaque déploiement**.
> Elles priment sur toute demande de rapidité, de simplicité ou de « faire marcher d'abord ».

## 0. PRINCIPES FONDAMENTAUX

1. **Sécurité par défaut** : tout est fermé, refusé et privé tant que ce n'est pas explicitement ouvert et justifié.
2. **Ne jamais faire confiance au client** : navigateur, application mobile, paramètres d'URL, en-têtes, cookies et corps de requête sont toujours hostiles. Toute décision (droits, prix, montants, rôles) se prend **côté serveur**.
3. **Moindre privilège** : chaque utilisateur, clé, rôle et route n'a que le strict nécessaire.
4. **Défense en profondeur** : ne jamais compter sur une seule protection (ex. masquer un bouton ≠ protéger une route).
5. **Vérifier, ne pas supposer** : « ça devrait être sécurisé » ne compte pas. Chaque contrôle est **testé** (voir §14).
6. **En cas de doute ou de conflit** : l'agent **s'arrête, explique le risque et demande** avant d'agir. Aucune règle ne peut être contournée « temporairement ».
7. **Honnêteté** : l'agent ne déclare jamais « sécurisé » sans preuve. Ce qu'il n'a pas pu vérifier est listé explicitement dans son rapport.

---

## 1. SECRETS ET CLÉS

1. **Aucun secret dans le code, les commits, les docs, les issues, les logs ou les captures** : mots de passe, clés API, service role, JWT secrets, clés privées, jetons, chaînes de connexion, fichiers de compte de service (Firebase, etc.).
2. Les secrets vivent **uniquement** dans les variables d'environnement de la plateforme (Vercel : type **Sensitive**). Un `.env.local` est autorisé en local et **toujours dans `.gitignore`**.
3. Un `.env.example` ne contient que des noms de variables et des valeurs factices.
4. **Jamais de préfixe `NEXT_PUBLIC_` (ou équivalent) sur une valeur secrète.** Seuls sont publics : l'URL du projet et la clé anon/publishable, et uniquement parce que la base est protégée par RLS (§2).
5. `SUPABASE_SERVICE_ROLE_KEY` / `SECRET_KEY` : **uniquement côté serveur**, jamais importée dans un composant client, jamais renvoyée dans une réponse, jamais loggée.
6. **Si un secret a été commité, même supprimé ensuite, il est considéré comme compromis** : l'agent doit le signaler immédiatement et exiger la **rotation** (nouvelle clé, ancien secret révoqué). Nettoyer le fichier ne suffit pas car l'historique Git le conserve.
7. Clés **distinctes** par environnement (dev / preview / production). Jamais les clés de production en local ou en preview.
8. Avant chaque commit, exécuter un scan de secrets (`gitleaks detect` ou équivalent). Un secret détecté **bloque** le commit.
9. Ne jamais afficher, copier ou résumer la valeur d'un secret dans une réponse, un rapport ou un message de commit.

---

## 2. BASE DE DONNÉES (SUPABASE / POSTGRES)

1. **RLS activée (`ENABLE ROW LEVEL SECURITY`) sur 100 % des tables du schéma `public`, sans exception**, dès la création de la table, dans la même migration.
2. **Retirer les droits par défaut** sur toute table non destinée à l'accès direct client :
   ```sql
   alter table public.ma_table enable row level security;
   revoke all on public.ma_table from anon, authenticated;
   ```
   Une table sensible (argent, commissions, retraits, jetons, logs, paramètres) n'est **jamais** accessible à `anon` ni à `authenticated` : accès uniquement via le serveur (service role) ou via une fonction RPC contrôlée.
3. Pour les tables accessibles au client : politiques **explicites et minimales** par opération (SELECT / INSERT / UPDATE / DELETE), avec `USING` **et** `WITH CHECK`. Jamais de `USING (true)` sur une table contenant des données non publiques.
4. Dans les politiques, écrire `(select auth.uid())` (et non `auth.uid()` seul) pour la performance, et éviter les politiques permissives multiples redondantes.
5. **Ne jamais baser une autorisation sur `user_metadata`** (modifiable par l'utilisateur). Les rôles vivent dans `app_metadata` ou dans une table `roles` protégée, modifiable uniquement côté serveur.
6. Les **vues** : `security_invoker = true` (ou vue non exposée). Les fonctions `SECURITY DEFINER` : `set search_path = ''`, droits `EXECUTE` révoqués à `public`/`anon` sauf besoin justifié, validation stricte des arguments.
7. **Requêtes paramétrées uniquement.** Jamais de SQL construit par concaténation de chaînes.
8. **Contraintes d'intégrité** : clés étrangères, `NOT NULL`, `CHECK` (montants ≥ 0, statuts dans une liste), `UNIQUE` sur les identifiants de transaction externes.
9. Index sur **toutes les clés étrangères** et sur les colonnes de filtre fréquentes.
10. Toute migration passe par un fichier versionné (`apply_migration`), jamais par des modifications manuelles non tracées en production.
11. **Après chaque migration ou changement de schéma, lancer les advisors Supabase (security + performance)**. Aucune alerte de niveau ERROR ou WARN sécurité ne peut rester (voir §14).
12. Sauvegardes automatiques activées ; restauration testée au moins une fois avant le lancement.

### Stockage (Storage / fichiers)
1. Buckets **privés par défaut**. Un bucket public ne contient que du contenu réellement public (couvertures, logos).
2. Contenu payant ou personnel (PDF de magazines, factures, pièces d'identité) : bucket **privé** + **URL signées à durée courte** générées côté serveur après vérification du droit d'accès.
3. Politiques Storage explicites : pas de listing public, pas d'écriture anonyme.
4. Upload : limite de taille, liste blanche de types MIME **vérifiés côté serveur** (pas seulement l'extension), nom de fichier régénéré (UUID), analyse du contenu quand c'est possible.

---

## 3. CONTRÔLE D'ACCÈS (AUTORISATION)

1. **Chaque route API, Server Action, fonction Edge et RPC vérifie, côté serveur : (a) l'authentification, (b) le rôle, (c) la propriété de la ressource.** Pas de vérification = route interdite.
2. **Anti-IDOR** : ne jamais faire confiance à un `id` reçu du client. Toujours filtrer par l'identité authentifiée (`where user_id = <utilisateur de la session>`).
3. Les routes et pages **admin** sont protégées côté serveur (middleware **et** vérification dans chaque handler), avec `noindex`, et journalisées.
4. Le **middleware seul ne suffit pas** : il ne remplace pas la vérification dans le handler.
5. Refus par défaut : toute route non explicitement autorisée renvoie 401/403.
6. Les réponses d'erreur n'exposent jamais de détails internes (stack, requête SQL, noms de tables). Message générique au client, détail dans les logs serveur.
7. **Contenu payant (paywall)** : la vérification du droit d'accès se fait **côté serveur avant l'envoi du contenu**. Le texte complet ne doit jamais être présent dans le HTML, le JSON ou les données hydratées d'un visiteur non autorisé.

---

## 4. AUTHENTIFICATION ET SESSIONS

1. **Ne jamais coder son propre système de mot de passe ou de session** quand Supabase Auth ou un fournisseur éprouvé le fait. Sinon : hachage `argon2id` ou `bcrypt` (coût adapté), jamais de MD5/SHA seuls.
2. Activer dans Supabase Auth : **protection contre les mots de passe compromis**, longueur minimale ≥ 10, confirmation d'e-mail obligatoire.
3. **MFA/2FA** obligatoire pour tous les comptes admin et recommandée pour les comptes qui manipulent de l'argent (affiliés, vendeurs).
4. **Anti-force brute** : limitation du nombre de tentatives par IP et par compte, délai croissant, CAPTCHA/Turnstile après échecs. Message d'erreur identique pour « compte inexistant » et « mauvais mot de passe ».
5. Cookies de session : `HttpOnly`, `Secure`, `SameSite=Lax` (ou `Strict`), durée limitée, renouvellement à la connexion, invalidation à la déconnexion et au changement de mot de passe.
6. Jamais de jeton de session ou de JWT dans `localStorage` ni dans l'URL.
7. **OAuth (Google, Facebook, TikTok)** : liste blanche stricte des URL de redirection, paramètre `state` vérifié, aucun `redirect_to` libre.
8. Réinitialisation de mot de passe et liens magiques : jetons à usage unique, expiration courte (≤ 1 h), invalidés après usage.
9. Actions sensibles (changement d'e-mail, de mot de passe, retrait d'argent) : **ré-authentification** ou confirmation supplémentaire.
10. Jamais de compte, mot de passe ou clé « de test/par défaut » dans le code livré.

---

## 5. ENTRÉES UTILISATEUR ET INJECTIONS

1. **Toute entrée est validée côté serveur avec un schéma strict (Zod ou équivalent)** : type, format, longueur, plage, liste blanche. Rejeter par défaut ce qui n'est pas attendu.
2. Les identifiants reçus (UUID, nombres) sont validés **avant** d'atteindre la base. Un identifiant invalide renvoie 400/404, jamais une erreur 500.
3. **XSS** : ne jamais utiliser `dangerouslySetInnerHTML` / `innerHTML` avec du contenu non maîtrisé. Si du HTML riche est nécessaire (articles), le **nettoyer côté serveur avec une bibliothèque de sanitisation** (DOMPurify ou équivalent) avec liste blanche de balises.
4. **CSRF** : tout endpoint qui modifie l'état exige un jeton anti-CSRF ou une vérification stricte de l'en-tête `Origin` + cookies `SameSite`.
5. **SSRF et redirections ouvertes** : toute route qui reçoit une URL en paramètre (ex. `/navigateur?url=…`, proxys d'images, webhooks sortants) applique une **liste blanche de domaines**, refuse les IP privées/locales (`127.0.0.1`, `169.254.x.x`, `10.x`, etc.) et les schémas autres que `https`.
6. Les liens externes utilisent `rel="noopener noreferrer"`.
7. Aucun `eval`, `new Function`, `child_process` ou exécution de commande avec des données utilisateur.
8. Limiter la taille des corps de requête, le nombre d'éléments par page (pagination bornée) et la profondeur des requêtes.

---

## 6. PAIEMENTS, PORTEFEUILLES, COMMISSIONS, AFFILIATION

Cette section s'applique à tout flux d'argent (Moneroo, Mobile Money, abonnements, dons, votes payants, retraits, commissions).

1. **Le prix, le montant, la devise et le bénéficiaire sont toujours calculés côté serveur** à partir de la base. Jamais lus depuis la requête du client.
2. **Un paiement n'est validé que par le webhook signé du prestataire**, jamais par la page de retour (`success_url`) ni par un appel du navigateur.
3. Webhooks : vérification de la **signature (HMAC)** avec le secret du prestataire, comparaison en temps constant, contrôle de l'horodatage (anti-rejeu), puis **re-vérification du statut** auprès de l'API du prestataire avant de créditer.
4. **Idempotence** : chaque transaction externe a un identifiant `UNIQUE`. Un webhook rejoué ne crédite jamais deux fois.
5. **Opérations atomiques** : toute écriture financière (crédit, distribution de commissions, retrait) s'exécute dans **une transaction SQL unique** (fonction RPC), avec verrouillage de ligne (`FOR UPDATE`) pour éviter les doubles dépenses et conditions de concurrence.
6. **Registre comptable en ajout seulement (ledger)** : on n'édite ni ne supprime jamais une écriture financière. Les corrections se font par écriture inverse. Le solde est vérifiable en rejouant le registre.
7. Retraits : solde vérifié en base au moment de la transaction, seuil minimum appliqué côté serveur, limites journalières, **validation admin** au-dessus d'un seuil, MFA/ré-authentification, notification à l'utilisateur, journal d'audit.
8. **Anti-fraude affiliation** : impossibilité de s'auto-parrainer, détection des boucles de parrainage, limitation du nombre de comptes par appareil/IP, commissions créées uniquement à partir d'un paiement confirmé (jamais d'un clic), clics comptés avec dédoublonnage et limitation.
9. Aucune clé de prestataire de paiement côté client. Aucune donnée de carte ou de compte Mobile Money complet stockée : uniquement les références de transaction du prestataire.
10. Tout le flux financier est couvert par des **tests automatisés** (paiement réussi, échoué, rejoué, montant falsifié, concurrence).

---

## 7. RÉSEAU, EN-TÊTES ET ANTI-ABUS

1. **HTTPS partout**, redirection HTTP→HTTPS, HSTS (`max-age=63072000; includeSubDomains; preload`).
2. **En-têtes de sécurité obligatoires** (configurés dans `next.config` ou Vercel) :
   - `Content-Security-Policy` stricte (pas de `unsafe-inline`/`unsafe-eval` sans justification ; liste blanche des seuls domaines utilisés : Supabase, Google Analytics, Moneroo, YouTube-nocookie, etc.)
   - `X-Content-Type-Options: nosniff`
   - `frame-ancestors 'none'` (ou `X-Frame-Options: DENY`)
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy` (désactiver caméra, micro, géolocalisation si inutiles)
3. **CORS** : liste blanche d'origines explicites. Jamais `*` sur une API authentifiée ou qui renvoie des données privées.
4. **Rate limiting** sur toutes les routes sensibles : connexion, inscription, réinitialisation, votes, paiements, contact, newsletter, API d'affiliation, recherche. Pare-feu Vercel (règles WAF, protection anti-bot) **activé et configuré**.
5. Formulaires publics (contact, newsletter, inscription, vote) : **CAPTCHA/Turnstile** + champ piège (honeypot) + validation serveur.
6. **Un seul domaine canonique** (`www` ou apex) : l'autre redirige, et le `canonical`, `og:url` et le sitemap utilisent le même hôte.
7. Les pages privées, admin, compte, panier et résultats de recherche sont en `noindex` et exclues du sitemap ; `robots.txt` n'est **pas** utilisé comme protection.

---

## 8. DÉPENDANCES ET CHAÎNE D'APPROVISIONNEMENT

1. Versions **figées** via le lockfile (`package-lock.json` / `pnpm-lock.yaml` commité). Installation reproductible (`npm ci`).
2. **`npm audit` (ou équivalent) sans vulnérabilité `high`/`critical`** avant toute livraison. Framework (Next.js), Supabase SDK, et bibliothèques d'auth mis à jour dès qu'un correctif de sécurité est publié.
3. N'ajouter une dépendance qu'après vérification : maintenue, populaire, nom exact (attention au *typosquatting*), licence compatible. Préférer l'API native à une bibliothèque quand c'est possible.
4. Aucun script `postinstall` d'origine inconnue. Aucun `curl | bash`.
5. Aucun code, image ou script chargé depuis un CDN non listé dans la CSP. Scripts tiers (analytics, pub) avec `async`/`defer` et chargés **après consentement** quand ils déposent des cookies.
6. Activer Dependabot/Renovate pour les alertes de sécurité.

---

## 9. DÉPLOIEMENT ET ENVIRONNEMENTS

1. Branche `main` **protégée** : pas de push direct, revue/CI obligatoire, historique non réécrit.
2. **CI obligatoire avant déploiement** : lint + typecheck + tests + build + scan de secrets + audit des dépendances. Un échec **bloque** la mise en production.
3. Vercel : *Deployment Protection* activée sur les previews, variables d'environnement en **Sensitive**, séparation stricte production / preview, accès à l'équipe en moindre privilège avec 2FA.
4. Production : `NODE_ENV=production`, aucun mode debug, aucune route de test/diagnostic (`/api/debug`, `/test`, `/phpinfo`, etc.), source maps non publiques.
5. Aucun fichier sensible dans le dossier public (`.env`, `.git`, sauvegardes, `*.sql`, `*.zip`, exports).
6. Les documents internes (specs, audits, notes) ne sont **jamais déposés dans le dépôt public** ni dans `public/`.
7. Déploiement **réversible** : rollback testé, migrations compatibles avec la version précédente.
8. Avant la mise en marché : test de restauration de sauvegarde, revue des accès et rotation des clés de démarrage.

---

## 10. JOURNALISATION, SURVEILLANCE, INCIDENTS

1. **Journal d'audit** (immuable) pour : connexions, échecs de connexion, changements de rôle, actions admin, paiements, retraits, modifications de commissions, suppression de données.
2. **Aucune donnée sensible dans les logs** : pas de mot de passe, jeton, clé, numéro de téléphone/Mobile Money complet, contenu de paiement, ni PII inutile.
3. Alertes sur : pics d'erreurs 5xx, timeouts, échecs de connexion en série, webhooks rejetés, retraits anormaux. Surveillance des erreurs runtime Vercel et des logs Supabase.
4. **Procédure d'incident** (en cas de fuite ou d'intrusion suspectée) : (1) isoler, (2) révoquer/renouveler tous les secrets concernés, (3) invalider les sessions, (4) analyser les logs, (5) informer les utilisateurs concernés et l'autorité de protection des données si nécessaire, (6) documenter et corriger la cause.

---

## 11. DONNÉES PERSONNELLES ET CONFORMITÉ

1. **Minimisation** : ne collecter que ce qui est nécessaire. Chiffrer en transit (TLS) et protéger au repos (chiffrement de la plateforme).
2. **Pages légales complètes et distinctes** : Mentions légales (éditeur, adresse, contact, hébergeur), Politique de confidentialité (responsable, finalités, durée de conservation, droits d'accès/suppression/portabilité, sous-traitants : Supabase, Vercel, Moneroo, Google), CGU/CGV, Politique de cookies, conditions du programme d'affiliation (y compris l'absence de garantie de revenus).
3. **Consentement cookies** : aucun traceur non essentiel (Google Analytics, AdSense, pixels) avant consentement explicite. Le refus doit être aussi simple que l'acceptation.
4. Fonction de **suppression/export** des données personnelles à la demande de l'utilisateur.
5. Ne jamais exposer publiquement d'e-mails, téléphones ou données d'utilisateurs (y compris dans les URL, les balises meta et les API publiques).

---

## 12. INTERDITS ABSOLUS

- ❌ Désactiver la RLS « pour que ça marche » ou « temporairement ».
- ❌ Utiliser la clé service role côté client, ou la mettre dans une variable `NEXT_PUBLIC_*`.
- ❌ Commiter un secret, un `.env`, un dump de base ou un export de données réelles.
- ❌ `USING (true)` / `WITH CHECK (true)` sur une table non publique.
- ❌ Valider un paiement, un droit d'accès ou un prix côté client.
- ❌ Créditer un portefeuille hors transaction atomique.
- ❌ Faire confiance à `user_metadata`, à un cookie non signé ou à un paramètre d'URL pour une autorisation.
- ❌ Désactiver la vérification TLS, ajouter `--force`, `--no-verify` ou ignorer une alerte de sécurité pour livrer plus vite.
- ❌ Laisser un compte, un mot de passe ou une route de test/debug en production.
- ❌ Copier un extrait de code trouvé en ligne sans le comprendre et le vérifier.
- ❌ Déclarer « terminé » ou « sécurisé » sans avoir exécuté les vérifications du §14.

---

## 13. QUAND L'AGENT CRÉE OU MODIFIE…

| Élément | Obligations minimales |
|---|---|
| **Nouvelle table** | RLS + `revoke` des droits inutiles + politiques minimales + index sur les FK + contraintes `CHECK` |
| **Nouvelle route API** | Authentification + rôle + propriété + validation Zod + rate limit + erreurs génériques |
| **Nouveau formulaire** | Validation serveur + CAPTCHA + anti-CSRF + limite de taille |
| **Nouvel upload** | Bucket privé + type MIME vérifié + taille limitée + nom régénéré + URL signée |
| **Nouveau paiement / flux d'argent** | Montant serveur + webhook signé + idempotence + transaction atomique + ledger + tests |
| **Nouvelle intégration tierce** | Clé côté serveur + entrée dans la CSP + scopes minimaux + consentement si traceurs |
| **Nouvelle page privée / admin** | Contrôle serveur + `noindex` + hors sitemap + journalisation |
| **Nouvelle dépendance** | Vérification de fiabilité + `npm audit` propre |

---

## 14. VÉRIFICATIONS OBLIGATOIRES AVANT TOUTE LIVRAISON

L'agent **exécute réellement** ces contrôles et en joint les résultats. « Non exécuté » = « non fait ».

1. **Supabase advisors** (security **et** performance) : **zéro alerte ERROR/WARN sécurité** (RLS désactivée, politiques manquantes sur tables exposées, mots de passe compromis, `SECURITY DEFINER` exposé, etc.).
2. **Contrôle des droits** : requête sur `information_schema.role_table_grants` confirmant qu'aucune table sensible n'est accessible à `anon`/`authenticated`.
3. **Test d'accès anonyme** : avec la clé anon seule, tenter de lire/écrire chaque table sensible et chaque route protégée. **Tout doit échouer** (401/403/vide).
4. **Test d'un utilisateur A sur les données de B** (IDOR) : doit être refusé sur chaque ressource.
5. **Scan de secrets** sur le code **et l'historique Git** (`gitleaks`), aucun résultat.
6. `npm audit --omit=dev` : aucune vulnérabilité high/critical.
7. Lint, typecheck, tests (dont tests des flux financiers) et build : tous verts.
8. **En-têtes** : vérifier CSP, HSTS, `nosniff`, `frame-ancestors`, cookies `HttpOnly/Secure/SameSite` sur le site déployé.
9. **Webhooks** : tester signature invalide, rejeu, montant falsifié : tout doit être rejeté ou ignoré.
10. **Paywall** : vérifier en visiteur non connecté que le contenu protégé n'apparaît ni dans le HTML, ni dans le JSON, ni dans le code source.
11. **Erreurs runtime Vercel** des dernières 24 h passées en revue, sans 500 liés à des entrées mal validées.
12. **Pages privées** : `noindex`, absentes du sitemap, inaccessibles sans authentification.

### Rapport de sécurité à fournir à chaque livraison
1. Ce qui a été fait (liste des contrôles §14 avec résultat : ✅ / ❌ / non vérifiable).
2. Ce qui **n'a pas pu être vérifié**, avec la raison.
3. Les risques résiduels et les décisions à prendre par le propriétaire.
4. Les secrets à renouveler, s'il y en a.
5. Les migrations appliquées.

---

## 15. DÉFINITION DE « TERMINÉ »

Une tâche n'est terminée que si **toutes** les conditions suivantes sont vraies :

- [ ] Toutes les règles ci-dessus sont respectées, sans dérogation.
- [ ] Les vérifications du §14 ont été exécutées et jointes.
- [ ] Aucun secret dans le code ni dans l'historique récent.
- [ ] RLS active partout, avec droits minimaux, et advisors sécurité à zéro alerte.
- [ ] Tous les flux d'argent sont atomiques, idempotents, signés et testés.
- [ ] Le rapport de sécurité a été remis au propriétaire.

**Si une seule case n'est pas cochée, le travail n'est pas livré.**