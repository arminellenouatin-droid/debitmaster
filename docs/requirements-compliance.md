# Audit de conformité — DebitManager

## Conclusion

Le code actuel respecte la direction générale du produit et constitue un socle fonctionnel sécurisé, mais il ne respecte pas encore l’ensemble du cahier des charges Bar Maquis Master. Il s’agit d’un Sprint 0/Sprint 1 avancé, pas encore du logiciel complet demandé.

## Matrice fonctionnelle

| Domaine | Exigence du document | État actuel | Évaluation |
|---|---|---|---|
| Produit | Application appelée DebitManager | Nom présent dans le code et les métadonnées | Conforme |
| Interface | Application élégante, mobile responsive | Accueil responsive et récemment refondu ; aucun audit complet de toutes les interfaces | Partiel |
| Type d’application | Application mobile | Le socle actuel est une application web responsive Next.js, pas encore une application mobile native ou PWA complète | Manquant |
| Compte exploitant | Inscription et connexion | Inscription et connexion e-mail/mot de passe reliées à Supabase | Partiel |
| Social login | Option réseaux sociaux | Aucun flux social DebitManager livré dans le socle actuel | Manquant |
| Téléphone | Inscription avec téléphone, nom, prénom et e-mail | Le flux actuel valide principalement e-mail et mot de passe ; le téléphone n’est pas opérationnel | Partiel |
| Choix du profil | Exploitant ou employé | Aucun choix de profil ni parcours employé dans l’interface actuelle | Manquant |
| Abonnements | Mensuel, trimestriel, semestriel, annuel avec les tarifs du cahier des charges | Mention prévue dans la documentation, mais aucun modèle, écran, paiement ou activation d’abonnement n’est livré | Manquant |
| Entreprise | Création d’un établissement | Création et lecture tenant-aware présentes dans le dashboard | Conforme pour le premier périmètre |
| Configuration établissement | Espaces de travail, horaires, informations opérationnelles | Non implémenté | Manquant |
| Employés | Inscription par code ou création par le propriétaire | Non implémenté | Manquant |
| Rôles | Serveur, superviseur, magasinier, gérant, barman, secrétaire, comptable, approvisionnement, cuisinier, chef, administrateur | Les rôles sont documentés mais aucune gestion complète n’est livrée | Manquant |
| Permissions | Droits cochables et dashboards selon le rôle | Aucun moteur de permissions métier ni écran d’attribution | Manquant |
| Catégories | Catégories et produits préconfigurés selon l’activité et l’abonnement | Création de catégories possible, mais catalogue préconfiguré et règles par activité non livrés | Partiel |
| Produits | Boissons, repas, formats, unités et produits variés | Le socle accepte seulement les types `UNIT`, `SERVICE` et `MENU`, avec nom, prix et stock | Partiel |
| Commandes | Création et lecture de commandes | Routes de création et lecture présentes ; total recalculé côté serveur | Partiel |
| Livraison | Commande reçue, préparée, retirée, livrée et notifications | Aucun workflow de statuts, livraison ou notification opérationnelle complet | Manquant |
| Sections | Répartition cuisine/bar et attribution à un cuisinier | Non implémenté | Manquant |
| Factures | Affichage, e-mail, impression et PDF | Non implémenté | Manquant |
| Paiements | Espèces, carte et mobile money | Table `payments` existante, mais aucun parcours de paiement fonctionnel | Manquant |
| Prestataires | KKiaPay, Moneroo et CinetPay | Aucun connecteur de paiement livré | Manquant |
| Commission | Commission de 1 % sur carte/mobile money | Non implémenté | Manquant |
| Stocks | Stock initial, seuil d’alerte, seuil de sécurité et mouvements | Routes et interface de stock présentes, avec contrôle du stock négatif | Partiel à avancé |
| Inventaire | Inventaire physique périodique, écarts et analyse | Non implémenté | Manquant |
| Approvisionnement | Demande, validation comptable/promoteur et lancement | Non implémenté | Manquant |
| Présence | Horaires, retard, absence et autorisation | Non implémenté | Manquant |
| Géolocalisation | Connexion liée au lieu de travail | Non implémenté | Manquant |
| Trésorerie | Fonds, retraits mobile money et suivi | Non implémenté | Manquant |
| Comptabilité | Dépenses, achats et comptabilité | Non implémenté | Manquant |
| Paie | Préparation, validation, notifications et paiement | Non implémenté | Manquant |
| Primes | Règles de primes par type de personnel | Non implémenté | Manquant |
| KPI | KPI administrateur et KPI par rôle | Aucun KPI réel dans le dashboard actuel | Manquant |
| Notifications | Notifications internes, e-mail et téléphone | Non implémenté dans DebitManager | Manquant |
| Messagerie | Messages aux groupes de personnel et réponses | Non implémenté | Manquant |
| Localisation | Détection automatique pays, langue et devise | Non implémenté ; aucun moteur i18n ou conversion d’affichage | Manquant |
| Sécurité | Auth SSR, sessions, tenant isolation et RLS | Clients SSR, proxy de session, contrôle tenant et RLS durci présents | Conforme pour le socle |
| Production | Déploiement Vercel | Projet Vercel relié, preview corrigé ; production complète à vérifier après fusion et variables d’environnement | Partiel |

## Ce qui est réellement codé

Le périmètre livré couvre l’authentification e-mail, le callback de confirmation, la protection du dashboard, la création d’un établissement, la création de catégories, la création de produits, la consultation du stock, les mouvements de stock, la création de commandes et les lignes de commande. Les contrôles d’appartenance au tenant sont effectués côté serveur et les politiques RLS du projet Supabase DebitManager ont été durcies.

## Décision

Il ne faut pas présenter la version actuelle comme conforme à la totalité du cahier des charges. Elle respecte l’architecture de départ et plusieurs fondations importantes, mais les fonctions d’abonnement, de rôles, de présence, de paiements, de trésorerie, de paie, de KPI, de notifications et de localisation restent à construire.

## Priorités recommandées

La priorité suivante doit être le modèle d’accès : choix exploitant/employé, invitations, rôles, permissions et dashboards par rôle. Ensuite viennent les abonnements et les paiements, car ils conditionnent l’activation commerciale. Le troisième lot doit couvrir le cycle complet commande–préparation–livraison–facture–paiement. Le quatrième doit traiter présence, stocks avancés et approvisionnement. Le cinquième doit couvrir trésorerie, comptabilité, paie, KPI, notifications et localisation.

Aucune donnée fictive ne doit être utilisée pour masquer les modules non développés. Chaque fonctionnalité doit être marquée comme disponible, en préparation ou non disponible jusqu’à son implémentation et son test réel.
