# Notes d’intégration Moneroo

La documentation officielle Moneroo décrit une intégration API unique donnant accès à plusieurs moyens de paiement. Le flux DebitManager doit conserver `provider = MONEROO`, créer un paiement avec état initial `PENDING`, puis attendre le retour vérifié du prestataire avant de confirmer l’encaissement.

Moneroo documente les événements `payment.initiated`, `payment.success`, `payment.failed` et `payment.cancelled`. Le webhook reçoit un objet comprenant notamment `event` et `data.id`, mais la documentation précise qu’il faut re-interroger l’API Moneroo pour obtenir le statut complet et ne pas faire confiance au seul contenu du webhook. L’endpoint doit répondre HTTP 200 rapidement ; les autres réponses sont considérées comme des échecs et Moneroo peut réessayer jusqu’à trois fois.

La signature du webhook arrive dans `X-Moneroo-Signature` et se vérifie par HMAC-SHA256 avec le secret de signature et le corps brut de la requête. DebitManager devra comparer la signature en temps constant, vérifier que la transaction existe dans le même tenant, traiter les événements de manière idempotente et ne passer `payments.status` à `SUCCESS` qu’après vérification serveur-à-serveur auprès de Moneroo.

Le secret Moneroo ne doit jamais être exposé dans le navigateur. Les variables attendues côté serveur seront au minimum `MONEROO_API_KEY`, `MONEROO_WEBHOOK_SECRET` et une URL publique de retour configurée dans l’application. La connexion réelle ne sera activée qu’après fourniture des identifiants marchands et vérification de l’endpoint exact de création de paiement dans la documentation Moneroo.

Références : [Documentation API Moneroo](https://docs.moneroo.io/) ; [Webhooks Moneroo](https://docs.moneroo.io/introduction/webhooks).

La documentation officielle précise que l’initialisation standard consiste à appeler l’API depuis le serveur pour générer un lien de paiement, puis à rediriger le client vers ce lien. La vérification serveur utilise `GET https://api.moneroo.io/v1/payments/{paymentId}/verify` avec un Bearer secret. Il faut comparer la référence, le statut `success`, la devise et le montant attendu avant de créditer une commande. Les clés secrètes restent côté serveur ; Moneroo limite aussi l’API à 120 requêtes par minute.

Références complémentaires : [Initialiser un paiement](https://docs.moneroo.io/payments/initialize-payment.md) ; [Vérifier une transaction](https://docs.moneroo.io/payments/transaction-verification.md) ; [Authentification Moneroo](https://docs.moneroo.io/introduction/authentication.md).

Le contrat d’initialisation vérifié est `POST https://api.moneroo.io/v1/payments/initialize` avec un corps comprenant `amount`, `currency: "XOF"`, `description`, `return_url`, `customer`, `metadata` et éventuellement `methods`. La réponse renvoie le lien hébergé dans `data.checkout_url` et l’identifiant dans `data.id`. Le secret doit être transmis uniquement dans `Authorization: Bearer ...` côté serveur.

Référence complémentaire : [Standard Integration Moneroo](https://docs.moneroo.io/payments/standard-integration.md).
