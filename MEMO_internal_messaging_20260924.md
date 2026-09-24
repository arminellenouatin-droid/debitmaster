# Mémo — Messagerie interne multi-format

## Objectif
Permettre aux agents d’un même établissement de discuter en privé avec texte, audio, documents, images et vidéos.

## Périmètre
Sont inclus : destinataires du même établissement, présence en ligne, conversations individuelles, pièces jointes privées, indicateurs envoyé/reçu/lu et actualisation automatique. Sont hors périmètre : groupes, appels audio/vidéo, partage public et messagerie entre établissements.

## Décisions techniques
Le module existant `internal_messages` est étendu plutôt que remplacé. Les fichiers sont stockés dans un bucket privé, avec URL signée temporaire. Les conversations sont isolées par `tenant_id`, et les destinataires sont vérifiés côté serveur. Une présence « en ligne » repose sur un heartbeat récent.

## Sécurité
Les fichiers sont limités par type et taille, stockés sous un chemin lié à l’établissement et à l’utilisateur, et servis uniquement via URL signée. L’API refuse tout destinataire externe ou inactif. Les messages ne peuvent être lus, envoyés ou marqués lus que dans le tenant autorisé.

## Plan
- Étendre le schéma et le bucket privé.
- Ajouter destinataires, présence, envoi média et statuts.
- Remplacer l’écran historique par une interface chat responsive.
- Vérifier typecheck, build et parcours agent à agent.
- Publier sur branche dédiée puis intégrer après validation.

## État réel
La migration `internal_messaging_multimedia_20260924` a été appliquée au projet Supabase DebitMaster. Les colonnes média, les horodatages de présence et le bucket privé ont été vérifiés en base. Le typecheck et le build Next.js passent. La branche de travail reste séparée de `main` pour permettre une validation et un retour arrière sans risque.
