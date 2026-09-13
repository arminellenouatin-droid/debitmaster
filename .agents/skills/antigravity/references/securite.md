# Sécurité — axe non négociable

À appliquer par défaut sur toute mission touchant au serveur, à une base de données, à l'authentification, à un formulaire, à une API ou à un paiement. Ne jamais attendre qu'on le demande.

## Secrets et configuration
- Aucune clé API, mot de passe, token ou secret en dur dans le code source, jamais.
- Toujours passer par des variables d'environnement (`.env` non commité, secrets du provider d'hébergement).
- Aucun secret ne doit être exposé côté client (JS visible dans le navigateur) — vérifier systématiquement qu'une clé "secrète" n'est pas passée à du code frontend.
- Le fichier `.env` (ou équivalent) doit toujours figurer dans `.gitignore`.

## Contrôle d'accès
- Toute action sensible (lecture/écriture de données d'un utilisateur, action admin, paiement) doit être vérifiée **côté serveur**, jamais seulement côté client. Le frontend peut masquer un bouton, seul le backend peut l'interdire réellement.
- Principe du moindre privilège : un utilisateur/service n'a accès qu'à ce dont il a strictement besoin.
- Vérifier systématiquement la propriété de la ressource (un utilisateur ne doit jamais pouvoir agir sur les données d'un autre en changeant un simple ID dans une requête — IDOR).

## Mots de passe et authentification
- Mots de passe toujours hashés avec un algorithme adapté (bcrypt/argon2), jamais en clair, jamais avec un hash faible (MD5/SHA1 seul).
- Sessions/tokens avec expiration raisonnable, invalidation possible, cookies sensibles en `HttpOnly` + `Secure` + `SameSite`.
- Limiter les tentatives de connexion (rate limiting) pour empêcher le brute force.

## Base de données
- Toujours utiliser des requêtes paramétrées / un ORM — jamais de concaténation de chaînes SQL avec une entrée utilisateur (injection SQL).
- Sauvegardes régulières pour toute donnée critique.
- Chiffrement des données sensibles au repos quand c'est justifié (données personnelles, financières).
- Ne jamais logger de données sensibles en clair (mots de passe, numéros de carte, tokens de paiement).

## Entrées utilisateur
- Toute entrée utilisateur est non fiable par défaut : valider et assainir côté serveur (pas seulement côté client, qui est un confort UX, pas une sécurité).
- Échapper les sorties pour éviter les injections XSS (ne jamais injecter du HTML/JS non échappé depuis une donnée utilisateur).
- Valider les types de fichiers, tailles et contenus lors des uploads ; ne jamais faire confiance à l'extension déclarée.

## Réseau et transport
- HTTPS obligatoire partout, y compris en développement si possible.
- En-têtes de sécurité recommandés : `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` (ou équivalent moderne), `Strict-Transport-Security`.
- CORS configuré de façon restrictive (jamais `*` sur une API qui manipule des données sensibles ou des paiements).

## Paiements et données sensibles (spécifique)
- Ne jamais stocker de numéro de carte bancaire ou de données de paiement brutes sur les serveurs du projet — laisser le prestataire de paiement (Moneroo, MTN MoMo) les gérer.
- Toujours vérifier les webhooks/callbacks de paiement via leur signature avant de les traiter comme fiables — ne jamais faire confiance à une simple requête entrante non vérifiée.
- Toute confirmation de paiement critique (déblocage d'un service, mise à jour de statut) doit être validée côté serveur via l'API du prestataire, jamais uniquement sur la base d'une redirection côté client.

## Déploiement
- Ne jamais déployer de code de debug (logs verbeux, endpoints de test, comptes par défaut) en production.
- Dépendances tenues à jour ; vérifier régulièrement les vulnérabilités connues (audit npm/pip, advisories de la plateforme d'hébergement).
- Sauvegarde et plan de rollback avant tout changement de schéma de base de données en production.

## Rappel
Ces règles s'appliquent par défaut à toute mission de code de l'utilisateur, sans qu'il ait besoin de les redemander à chaque fois.
