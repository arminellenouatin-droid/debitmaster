# Intégration des paiements — Moneroo & MTN Mobile Money

Ce fichier donne la méthode à suivre. Les APIs de paiement évoluent régulièrement : avant toute intégration ou correction, faire une recherche web ciblée sur la documentation officielle à jour de Moneroo et/ou MTN MoMo (endpoints, format exact des payloads, mécanismes de signature) plutôt que de se fier uniquement à la mémoire d'entraînement, qui peut être obsolète.

## Méthode générale d'intégration (valable pour les deux)

1. **Cadrer avant de coder** : quel flux exact ? (paiement unique, abonnement, vote/don, marketplace avec split de paiement...). Quelle devise ? Quel pays/opérateur ciblé précisément pour MTN MoMo (les endpoints diffèrent par pays) ?
2. **Sandbox d'abord, toujours** : ne jamais tester une intégration de paiement directement en production. Utiliser les identifiants et environnements de test fournis par Moneroo / MTN avant tout passage en réel.
3. **Clés API côté serveur uniquement** — jamais exposées côté client (voir `references/securite.md`).
4. **Flux recommandé** :
   - Le serveur initie la transaction auprès du prestataire (jamais le client directement, pour ne pas exposer les clés secrètes ni permettre la falsification du montant).
   - L'utilisateur est redirigé/complète le paiement (redirection Moneroo, ou USSD/push MTN MoMo selon le flux).
   - Le **webhook/callback serveur-à-serveur** du prestataire est la seule source de vérité pour confirmer qu'un paiement a réellement abouti — jamais une simple redirection côté navigateur, qui peut être manipulée ou interrompue.
   - Vérifier la signature/authenticité du webhook avant de traiter la confirmation.
   - Idempotence : un même webhook peut arriver plusieurs fois — s'assurer qu'un paiement déjà traité n'est jamais compté deux fois (vérifier par l'identifiant unique de transaction avant d'appliquer l'effet métier).
5. **Statuts et erreurs** : gérer explicitement tous les statuts possibles (réussi, échoué, en attente, expiré, annulé) — ne jamais supposer qu'une absence de réponse = échec ou succès.
6. **Traçabilité** : conserver un enregistrement de chaque tentative de transaction (identifiant, montant, statut, horodatage) côté application, sans jamais stocker de données de paiement brutes sensibles (voir sécurité).

## Spécificités Moneroo
- Agrégateur multi-moyens de paiement (dont mobile money, cartes) pensé pour l'Afrique — vérifier lors du cadrage quels moyens de paiement précis doivent être activés dans le compte Moneroo du projet.
- Utiliser le SDK/API officiel et suivre le flux de "checkout" ou d'initiation de paiement documenté à jour.
- Vérifier la devise supportée et les pays couverts pour le cas d'usage précis avant de développer.

## Spécificités MTN Mobile Money (MTN MoMo)
- L'API MTN MoMo (MoMo API / MoMo Open API selon le pays) est généralement organisée par produit : Collections (encaisser un paiement d'un client), Disbursements (verser de l'argent), Remittances.
- Les identifiants d'API (subscription key, API user/API key) sont spécifiques à un environnement (sandbox vs production) et souvent à un pays — bien vérifier la correspondance avant tout déploiement.
- Le flux "Collection" typique : créer une requête de paiement (`RequestToPay`) avec le numéro du payeur, montant et référence externe, puis interroger le statut ou attendre le callback pour confirmer.
- Toujours prévoir la gestion du cas où l'utilisateur n'a pas validé le push USSD à temps (statut "en attente" puis expiration).

## Débogage / correction d'une intégration existante
- Avant de modifier quoi que ce soit : lire les logs de transaction existants et reproduire le problème précisément (quel statut est attendu, lequel est reçu réellement).
- Vérifier en premier les causes les plus fréquentes : mauvais environnement (sandbox vs prod), clé API expirée/révoquée, signature de webhook mal vérifiée, montant ou devise mal formatés, décalage entre le format attendu par l'API et celui envoyé.
- Ne jamais corriger un bug de paiement en "faisant confiance" au frontend pour valider un paiement — toujours re-vérifier côté serveur auprès du prestataire avant de considérer un paiement comme confirmé.
