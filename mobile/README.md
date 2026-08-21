# DebitManager Mobile (Flutter)

Application Android/iOS **offline-first** pour les équipes en salle :
prise de commande, consultation stock et paiement espèces **sans connexion**,
synchronisation différée (file d'attente locale + déduplication par `client_generated_id`).

## État

- ✅ Scaffold + design tokens (`lib/theme/tokens.dart` — source unique avec le web)
- ✅ Écran d'accueil (icônes, gros boutons, clair/sombre)
- ⏳ À développer (backlog : sprints 0, 2) : auth OTP, onboarding, commandes offline,
  KDS bar/cuisine, badgeage géolocalisé, sync SQLite chiffré → Supabase.

## Démarrage

```bash
flutter pub get
flutter run
```

Le backend est Supabase (mêmes migrations que le web). Les variables
`SUPABASE_URL` / `SUPABASE_ANON_KEY` se configurent via `--dart-define`.
