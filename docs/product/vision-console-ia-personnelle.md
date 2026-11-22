# Vision — Console IA personnelle / AI Command Center

Date : 22 novembre 2026
Statut : idée à conserver pour étude ultérieure ; **pas une priorité immédiate**.

## Intention

Mounir souhaite étudier la création d'une console personnelle centralisant plusieurs modèles d'IA et leur accès aux projets et outils de développement. L'idée dépasse BETWISE et pourrait devenir un environnement de travail commun pour ses projets actuels et futurs.

Le concept s'apparente à un « OpenRouter personnel », mais ne se limite pas au routage des requêtes vers des modèles : la console pourrait également orchestrer des agents et leurs accès aux outils de projet.

## Objectif envisagé

Depuis une interface unique, Mounir pourrait :
- sélectionner ou laisser la console sélectionner un modèle selon la tâche ;
- interroger plusieurs modèles séparément ou leur demander de confronter leurs analyses ;
- connecter des projets GitHub et leurs environnements associés ;
- demander des audits de code, des analyses de bugs et de déploiements ;
- préparer des branches, commits ou pull requests ;
- consulter les résultats et suivre les actions des agents ;
- conserver l'historique des tâches, décisions et validations.

## Modèles / fournisseurs à étudier

Candidats API à examiner : Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek, Mistral, xAI Grok, Cohere et autres fournisseurs compatibles.

Meta AI est également un candidat à étudier, puisque Mounir possède un compte Meta AI. Ne pas supposer que le compte grand public peut être directement connecté ou piloté par API. Vérifier les voies officielles d'accès aux modèles Meta/Llama, les conditions d'utilisation, les coûts, les limites et la compatibilité avec l'orchestration.

Important : les abonnements grand public (ChatGPT, Claude, etc.) ne donnent pas automatiquement accès à leurs API avec les mêmes conditions. Distinguer clairement :
- l'intégration d'un modèle via API ;
- la connexion OAuth ou autre d'un compte utilisateur ;
- l'automatisation d'une interface web, qui peut être fragile et soumise aux conditions du service.

## Connecteurs et outils envisagés

- GitHub : dépôts, branches, fichiers, commits, issues, pull requests.
- Vercel : projets, builds, déploiements, logs et diagnostic.
- Supabase : projets, schéma, logs, requêtes et migrations selon permissions.
- Autres connecteurs à ajouter plus tard selon les projets et les besoins.

Étudier MCP (Model Context Protocol) comme standard de connexion entre les agents IA et les outils, notamment les serveurs MCP officiels ou documentés de GitHub, Vercel et Supabase.

## Architecture de départ à évaluer

Piste technique préliminaire, non validée :
- interface web centralisée ;
- backend/orchestrateur pour planifier les tâches et choisir les modèles ;
- gateway multi-modèles, éventuellement OpenRouter au départ ;
- Vercel AI SDK ou une abstraction équivalente pour intégrer plusieurs fournisseurs ;
- connecteurs MCP pour les outils ;
- authentification OAuth lorsque disponible, gestion sécurisée des clés et secrets ;
- historique des tâches, résultats et actions ;
- validation utilisateur pour les opérations sensibles.

Une architecture permettant de remplacer OpenRouter par des API directes ou d'autres gateways serait préférable afin d'éviter un verrouillage fournisseur.

## Sécurité et règles impératives

- Accès en lecture seule par défaut.
- Permissions limitées par projet et par outil.
- Secrets conservés côté serveur, jamais exposés dans le navigateur ou les prompts.
- Demander l'approbation de Mounir avant écriture, suppression, migration, modification de production, fusion ou déploiement.
- Journaliser les actions et distinguer recommandations, actions préparées et actions réellement exécutées.
- Séparer les environnements de test et de production.
- Aucun abonnement, API payante ou coût récurrent sans accord explicite.
- Ne pas prétendre qu'un modèle ou compte est connecté tant que l'intégration n'a pas été testée.

## Déploiement progressif proposé

1. Console personnelle avec chat, projets et connexion GitHub en lecture seule.
2. Gateway multi-modèles avec sélection manuelle, puis routage simple selon la tâche.
3. Connecteurs Vercel et Supabase avec permissions restreintes.
4. Agents autonomes sur des tâches limitées, avec journal et approbation.
5. Collaboration multi-modèles : analyses indépendantes, confrontation et synthèse.
6. Actions de développement contrôlées : branches, PR, tests et diagnostics de déploiement.

## Timing / déclencheur de reprise

Mounir souhaite **reprendre cette idée après avoir suffisamment avancé sur les profils de test IA BETWISE** (ChatGPT autonome, Claude autonome et Fusion), afin de ne pas disperser les efforts.

Quand les profils de test auront progressé, Claude devra :
1. relire ce document ;
2. donner son avis indépendant sur la faisabilité et l'architecture ;
3. proposer un MVP à faible coût, en distinguant les comptes grand public des accès API ;
4. vérifier la compatibilité réelle des modèles et connecteurs envisagés ;
5. proposer une roadmap, les risques de sécurité et une estimation des coûts ;
6. présenter les choix à Mounir avant toute implémentation.

Ce document consigne une vision à explorer ultérieurement. Il n'autorise aucune création de service payant, intégration, modification de projet, déploiement ou action sur les environnements de production.
