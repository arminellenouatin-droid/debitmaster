# Sobriété en tokens — réduire la consommation d'au moins 70%

Objectif : produire le même résultat professionnel avec le minimum de tokens consommés (lecture, réflexion, écriture). Ces règles s'appliquent en continu, pas seulement sur demande.

## 1. Chargement progressif du contexte
- Ne jamais charger un fichier/projet entier "au cas où". Identifier précisément quel(s) fichier(s) ou section(s) la mission concerne avant de lire quoi que ce soit.
- Utiliser la recherche par mot-clé (grep, recherche de fonction/symbole) pour localiser la zone concernée plutôt que d'ouvrir un fichier volumineux en entier.
- Ne relire un fichier déjà vu dans la conversation que si le contenu a pu changer depuis — sinon réutiliser ce qui est déjà en contexte.

## 2. Édition ciblée, jamais de réécriture complète par défaut
- Modifier via un patch précis (remplacement d'un bloc identifié) plutôt que régénérer un fichier entier, dès que le changement touche moins de la moitié du fichier.
- Ne réécrire un fichier en entier que si la structure change fondamentalement ou si le fichier est court (quelques dizaines de lignes).
- Ne jamais recopier dans la réponse conversationnelle un code déjà écrit dans un fichier — renvoyer au fichier plutôt que de le dupliquer.

## 3. Le mémo comme mémoire externe (voir `memo-projet-template.md`)
- Relire le mémo de mission plutôt que de rescanner tout le projet pour "se remettre dans le contexte" à chaque reprise.
- Le mémo doit rester court (10-20 lignes) : un mémo trop détaillé coûte lui-même des tokens à relire à chaque fois.

## 4. Une seule passe de cadrage
- Poser toutes les questions structurantes en une fois (Phase 1), pas par petites touches sur plusieurs échanges — chaque aller-retour incomplet coûte un rechargement de contexte.
- Éviter les cycles "coder → se tromper faute de cadrage → recoder" : c'est la source la plus coûteuse de gaspillage de tokens, largement plus que la taille du code lui-même.

## 5. Batching des appels d'outils
- Grouper plusieurs lectures ou recherches nécessaires en un minimum d'appels plutôt qu'un appel par fichier/question.
- Planifier les informations nécessaires avant de commencer à chercher, plutôt que de chercher un élément à la fois de façon réactive.

## 6. Scripts déterministes pour les tâches répétitives
- Pour un renommage massif, une migration de données, un remplacement systématique : écrire un script qui exécute la tâche en une commande plutôt que de traiter chaque occurrence par un raisonnement pas-à-pas.
- Un script coûte des tokens une fois à l'écriture ; un raisonnement répété coûte des tokens à chaque occurrence.

## 7. Réutilisation des patterns existants
- Ne jamais réinventer une structure, un composant ou une convention déjà présente dans le projet : la référencer et la réutiliser plutôt que la redécrire ou la ré-expliquer.

## 8. Concision des réponses
- Pas de préambule, pas de reformulation de la demande, pas de ré-explication de ce qui est déjà acquis dans la conversation.
- Ne pas réafficher un bloc de code déjà montré s'il n'a pas changé — indiquer seulement ce qui change.
- Résumer plutôt que citer intégralement quand un résumé suffit à la décision à prendre.

## 9. Réflexion étendue réservée aux décisions structurantes
- Réserver un raisonnement approfondi (extended thinking) aux choix d'architecture, de sécurité ou de paiement qui sont difficiles à défaire.
- Sur une tâche triviale ou un pattern déjà connu du projet, trancher directement sans déployer un raisonnement long.

## Compétences que l'agent doit démontrer concrètement
- Savoir choisir entre patch ciblé et réécriture complète selon la taille réelle du changement.
- Savoir écrire un script one-shot pour toute tâche répétitive plutôt que de la traiter manuellement élément par élément.
- Savoir résumer un fichier long avant de décider quoi en faire, plutôt que le citer en entier.
- Savoir maintenir et relire le mémo de mission au lieu de rescanner le projet à chaque reprise.
- Savoir grouper ses appels d'outils au lieu de les enchaîner un par un de façon réactive.

## Limite honnête
Ces pratiques réduisent fortement la consommation sur des tâches répétitives, des projets déjà cadrés, et des corrections ciblées. Sur une mission réellement nouvelle et complexe (nouvelle architecture, nouveau design de zéro), le gain sera réel mais plus modeste — la clarté et la qualité du résultat restent prioritaires sur l'économie de tokens, jamais l'inverse.
