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
