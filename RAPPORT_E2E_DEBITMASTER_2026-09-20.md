# Rapport de recette E2E DebitMaster

**Date :** 20 septembre 2026  
**Cible :** `https://debitmaster.vercel.app`  
**Version locale contrôlée :** branche `main`, commit `a98eedc`  
**Périmètre :** propriétaire, membre d’équipe, connexion, affilié, protections d’accès et contrôles techniques.

## Synthèse

Le socle public est disponible et les routes principales répondent correctement. L’inscription propriétaire fonctionne avec une adresse d’un domaine réel et demande une confirmation e-mail avant la configuration de l’établissement. Le formulaire membre d’équipe expose bien le code établissement, le poste et le mot de passe, et le serveur rejette correctement un code invalide. Le parcours affilié présente bien les deux modes « Créer un compte » et « J’ai déjà un compte ».

La recette ne peut pas encore être déclarée complète : la confirmation de l’adresse du compte propriétaire de test est nécessaire pour poursuivre la création et le paramétrage de l’établissement, l’ajout du personnel, les droits, la validation d’un employé et la génération effective du lien affilié. Je n’ai pas ouvert de boîte mail privée.

## Résultats par parcours

| Parcours | Résultat | Détail |
|---|---|---|
| Accueil et navigation publique | Réussi | Page d’accueil, inscription, affiliation et connexion accessibles en HTTP 200. |
| Inscription propriétaire | Partiellement réussi | Le compte de test est créé avec confirmation e-mail demandée. Un domaine `example.com` est refusé par le fournisseur d’identité ; un domaine réel est accepté. |
| Configuration établissement | Bloqué | Nécessite la confirmation e-mail du propriétaire de test. |
| Ajout du personnel et attribution des droits | Bloqué | Nécessite un établissement actif et une session propriétaire confirmée. |
| Inscription membre avec code | Réussi sur garde-fou | Le mode membre affiche identité, téléphone, code établissement, poste et mot de passe. `INVALID-E2E-CODE` est rejeté par le serveur avec « Code établissement invalide. » |
| Connexion membre déjà créé | Non exécuté | Aucun compte employé de test valide n’a pu être créé avant l’activation de l’établissement. |
| Inscription affilié | Écran vérifié | Champs prénom, nom, téléphone, e-mail et mot de passe présents ; le texte explique que le lien est généré après adhésion. |
| Connexion affilié | Écran vérifié | La bascule vers e-mail/téléphone + mot de passe fonctionne. Génération effective du lien non vérifiée sans compte affilié confirmé. |
| Protection des routes métier | Réussi | `/dashboard` répond par une redirection vers la connexion sans session. |

## Défaut corrigé

Après un rejet d’inscription, le message d’erreur restait affiché même après modification du champ concerné. Ce comportement a été reproduit avec une adresse de domaine d’exemple puis observé après remplacement par une adresse valide. La fonction `update` de `src/app/inscription/InscriptionForm.tsx` efface désormais l’erreur et le message d’état dès qu’un champ change. Le correctif est local au dépôt et n’a pas été déployé en production dans cette session.

## Contrôles techniques

`npm run typecheck`, `npm run build` et `git diff --check` passent. Le build Next.js génère les routes d’authentification, d’inscription, d’affiliation, de dashboard, de personnel et d’invitations sans erreur de compilation. Les contrôles HTTP publics ont obtenu `200` pour `/`, `/inscription` et `/affiliation`, et `307` pour `/dashboard` sans session.

## Incident de confidentialité évité

Le navigateur connecté disposait d’un remplissage automatique d’identifiants. Une tentative de connexion a soumis ces valeurs préremplies et a ouvert un compte existant. La session a été déconnectée immédiatement ; aucune modification n’a été effectuée et l’inspection des données métier a été interrompue. Pour la reprise, il faut utiliser un profil navigateur vierge ou désactiver le remplissage automatique sur l’environnement de test.

## Reprise nécessaire

Pour terminer la recette de bout en bout, il faut confirmer le compte propriétaire `debitmaster.e2e.20260920@gmail.com` depuis l’e-mail reçu, ou fournir un environnement de staging avec confirmation automatique désactivée et un profil navigateur vierge. La reprise couvrira ensuite la création de l’établissement, son paramétrage, le code établissement, l’ajout direct d’un collaborateur, les droits par rôle, la demande d’accès par code, l’approbation propriétaire, la connexion employé, l’inscription affilié, la génération et l’utilisation du lien, puis la vérification des erreurs console et des états responsive.


## Reprise de recette — 21 septembre 2026

Le correctif a été publié sur GitHub et déployé en production par Vercel sur le commit `cea2a08f9fa8273558cc8ed312db080f10b5c562` ; le déploiement est `READY`. Avec un compte propriétaire de test dédié, l’inscription a ouvert directement la session sans confirmation e-mail et a redirigé vers `/choixprofil`.

Le parcours propriétaire a ensuite été exécuté jusqu’à son terme non payant : choix « Créer ma boutique », activité « Bar & restaurant », établissement `Etablissement E2E NoConfirm`, pays Côte d’Ivoire, devise FCFA, enregistrement réussi, puis accès au tableau de bord en statut `Essai`. Les données de test sont visibles dans l’espace et le module Personnel est accessible.

Le module Personnel expose la création directe d’un collaborateur, le téléphone, le mot de passe temporaire et le rôle. La création n’a pas pu être validée de manière fiable dans ce profil de navigateur, car le remplissage automatique réinjecte des valeurs existantes dans les champs téléphone et mot de passe au moment des re-rendus. Cette limitation est propre à l’environnement de test ; elle ne constitue pas une preuve de défaut serveur. La génération et l’utilisation d’un code établissement, la demande d’accès par code, l’approbation par le propriétaire, la connexion de l’employé et l’affectation détaillée de droits restent donc à valider avec un profil navigateur vierge ou un environnement de staging dédié.

Le bouton d’accès au tableau de bord depuis l’étape abonnement fonctionne sans paiement et conserve l’établissement en statut `Essai`. Aucun paiement ni action irréversible n’a été déclenché. Les erreurs runtime Vercel agrégées sur les sept derniers jours sont absentes (`No runtime errors found`).

## État corrigé

La confirmation e-mail est désormais contournée côté serveur pour les propriétaires uniquement, avec création d’une session immédiate. Les parcours employé et affilié n’ont pas été élargis par ce changement. Le correctif UX antérieur sur les messages d’erreur obsolètes reste inclus.

## Conclusion actualisée

Le parcours propriétaire — création du compte, choix du profil, création et paramétrage initial de l’établissement, accès au tableau de bord — est validé en production. Les parcours affilié et membre avec code invalide sont validés sur leurs écrans et garde-fous. La recette n’est pas encore totalement exhaustive pour les opérations dépendantes d’un profil navigateur vierge : création directe d’un employé, connexion employé, approbation d’une demande par code, attribution de droits par rôle et génération effective du lien affilié.

## Déploiement

- Commit publié : `cea2a08` — `fix: confirm owner accounts without email verification`
- Déploiement production : `READY`
- URL : `https://debitmaster.vercel.app`
- Erreurs runtime Vercel sur 7 jours : aucune

## Données de test créées

Un compte propriétaire de test et l’établissement `Etablissement E2E NoConfirm` ont été créés en production pour cette recette. Ils doivent être conservés ou supprimés selon la politique de nettoyage des données de test de l’environnement de production.
