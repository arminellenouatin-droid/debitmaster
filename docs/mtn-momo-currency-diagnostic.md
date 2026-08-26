# Diagnostic MTN MoMo — devise sandbox

## Cause confirmée

Les comptes et commandes DebitManager sont correctement enregistrés en `XOF`. Le message `Currency not supported` vient du sandbox MTN MoMo : la documentation communautaire MTN précise que le sandbox accepte uniquement `EUR`; les devises propres aux marchés, notamment `XOF` pour le Bénin, sont destinées à la production.

Sources consultées :

- [MTN MoMo Community — Currency not supported / INVALID_CURRENCY](https://momodevelopercommunity.mtn.com/momo-api-sand-box-q-a-6/currency-not-supported-invalid-currency-258)
- [MTN MoMo Common Error — renouvellement des identifiants sandbox](https://ericssondeveloperapi.developer.azure-api.net/api-documentation/common-error)

## Décision de correction

La devise métier et la devise enregistrée dans Supabase restent `XOF`. Seule la charge utile envoyée au fournisseur est adaptée selon l’environnement :

| Environnement | Devise envoyée à MTN MoMo | Devise métier conservée |
| --- | --- | --- |
| Sandbox | `EUR` | `XOF` |
| Production | `XOF` | `XOF` |

Cette adaptation permet de tester le cycle RequestToPay, confirmation, webhook et idempotence sans transformer les comptes, les prix, les factures ou les commissions de DebitManager. Le montant sandbox reste un montant de test et ne représente pas une conversion financière réelle.

## Garde-fous

Le code doit centraliser ce mapping dans le client MTN MoMo, ne jamais exposer de secret au navigateur, conserver `currency = XOF` dans les écritures locales et reprendre `XOF` automatiquement dès que `MTN_MOMO_TARGET_ENVIRONMENT` vaut `production`.


## Diagnostic complémentaire du polling

Le test direct en lecture seule avec les identifiants sandbox a obtenu un jeton HTTP `200`, puis un GET de statut HTTP `200` avec `SUCCESSFUL` pour la référence de paiement existante. Le paiement local correspondant est encore `PENDING`, ce qui montre que l’échec signalé par l’interface provient du polling ou d’un retour transitoire de la route, et non d’une devise invalide persistante.

Le journal Vercel a enregistré un `502` sur `/api/payments/mtn-momo/status` quelques secondes après la création de la demande. La correction doit donc traiter les réponses transitoires du fournisseur, notamment un statut non encore indexé ou une erreur réseau, en réessayant sans créer une nouvelle demande de paiement. Une référence déjà créée ne doit jamais être remplacée par une nouvelle référence pendant le polling.


## Cause complémentaire dans le webhook

Le callback sandbox renvoie légitimement `currency: EUR`, alors que le paiement local reste enregistré en `XOF`. L’ancien contrôle comparait directement ces deux valeurs et pouvait rejeter une confirmation valide. Le contrôle compare désormais la devise du callback à la devise effectivement attendue par le fournisseur selon l’environnement ; en sandbox, EUR est accepté pour un paiement métier XOF, tandis qu’en production XOF reste attendu.

Le polling est également rendu tolérant aux erreurs HTTP transitoires du GET de statut et les erreurs réseau ne sont plus renvoyées comme une erreur serveur générique sans indication exploitable. Aucun nouveau paiement n’est créé pendant ces relances.
