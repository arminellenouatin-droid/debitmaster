# Mémo de Mission : Système de Messagerie Interne WhatsApp & Notifications Push

## 1. Objectif
Implémenter la messagerie interne d'établissement style WhatsApp (texte, notes vocales audio, photos, vidéos, appels audio et appels vidéo WebRTC) avec isolation stricte par établissement (`tenant_id`), bridage Option Normale (texte seul) vs Option Avancée (médias et appels), et notifications push Google Chrome avec sonnerie mélodique, vibration et redirection directe.

## 2. Périmètre
- **Inclus** :
  - `GET /api/messages/contacts` : liste des collègues du tenant, statut de l'option avancée, compteurs non lus.
  - `GET /api/messages` : récupération des messages (canal équipe ou direct 1-on-1), génération d'URL signées pour les médias privés, accusés de lecture.
  - `POST /api/messages` : validation de l'appartenance au tenant, contrôle d'accès Option Avancée pour `AUDIO`, `IMAGE`, `VIDEO`, insertion et notification push du destinataire.
  - `POST /api/messages/upload` : upload sécurisé des notes vocales, photos et vidéos dans le bucket privé `internal-message-media`, conditionné à l'Option Avancée.
  - `POST /api/messages/call-signal` : signalement d'appels et journalisation (manqué, terminé, durée) réservé à l'Option Avancée.
  - `src/app/dashboard/messages/MessagesClient.tsx` : interface complète WhatsApp-style responsive (liste des contacts, lecteur audio avec waveform, prévisualisation photo/vidéo, enregistreur vocal direct, modal d'appel WebRTC audio/vidéo avec sonnerie et contrôles, et modal d'upgrade vers Option Avancée).
  - Validation complète (types, lint, build).
- **Exclu** :
  - Tout échange hors établissement : les contacts et messages sont strictement confinés au `tenant_id`.

## 3. Décisions techniques & Sécurité
- **Isolation Tenant** : vérification stricte côté serveur que l'émetteur et le destinataire appartiennent au même `tenant_id`.
- **Gating Option Avancée** : vérifié côté serveur avec `companyHasSpecialOption(company)`. Rejet 403 si l'établissement est sur l'Option Normale et tente d'uploader ou d'initier un appel.
- **Stockage Médias** : bucket privé `internal-message-media`, URLs signées à expiration courte (3600s).
- **Temps Réel & WebRTC** : Supabase Realtime Broadcast pour les signaux d'appel légers et la mise à jour instantanée du chat, combiné au Web Push FCM v1 + Carillon harmonique Web Audio + Vibration.

## 4. Checklist d'Exécution & État Livré
- [x] Correction du bug de création de commande pour la serveuse Yvette (`position: SERVEUR`).
- [x] Push Google Chrome + sonnette mélodique (587Hz -> 784Hz -> 988Hz) + vibration haptique + redirection au clic.
- [x] Alerte quotidienne d'expiration d'abonnement (à $\le 10$ jours) avec push, chime et vibration.
- [x] Création de la route API `GET /api/messages/contacts` (liste des collègues, canal équipe, badge Option Avancée).
- [x] Création de la route API `POST /api/messages/upload` (stockage privé `internal-message-media`, URLs signées, bridage Option Avancée).
- [x] Création de la route API `POST /api/messages/call-signal` (WebRTC signaling, journalisation des appels, bridage Option Avancée).
- [x] Enrichissement de la route API `GET/POST /api/messages` (messages 1-à-1 ou équipe, accusés de lecture, notifications push instantanées).
- [x] Refonte complète de l'interface `MessagesClient.tsx` (WhatsApp UI, Voice Recorder, WebRTC Call Modal, Option Avancée Gating).
- [x] Suite de tests unitaires et de régression `tests/internal-messaging.test.mjs` (123 tests passés avec succès).
- [x] Compilation TypeScript (`tsc --noEmit`) et build de production (`next build`) 100% verts.
