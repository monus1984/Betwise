# Automatisation des tipsters ChatGPT et Fusion

Date : 22 novembre 2026  
Branche de préparation : `tipster-chatgpt-automation`  
Statut : préparation technique ; **pas encore fusionnée sur `main`, pas encore activée en production**.

## Réponse à la question de Mounir

Oui, le profil ChatGPT est conçu pour produire automatiquement des choix aux trois créneaux du tipster actuel : **07:50, 13:50 et 17:50 UTC** (heure d'Abidjan). Le workflow GitHub est planifié. Il ne dépend pas d'une conversation ChatGPT ouverte.

Ce fonctionnement utilise l'**API OpenAI**, pas le compte ChatGPT Go ni l'abonnement Claude Pro. L'API est facturée séparément selon le modèle et l'usage. Aucun appel API ne sera fait tant que la clé n'est pas configurée.

## Ce qui a été préparé dans cette branche

- `.github/workflows/tipster-chatgpt.yml` : workflow planifié aux mêmes horaires que le tipster actuel. Si la clé ou le modèle API manque, le passage est ignoré sans appel ni écriture.
- `scripts/tipster-chatgpt.ts` : prépare le dossier de candidats BETWISE, demande une décision structurée à l'API OpenAI, vérifie que les choix correspondent à des candidats connus, puis applique les limites et les mises virtuelles du système.
- `src/lib/tipster-virtuel/compte.ts` : ajout de fonctions de compte robot réutilisables et des identifiants séparés ChatGPT/Fusion. Le compte d'audit existant de Claude reste compatible.
- Rapport ChatGPT prévu sur la branche séparée `rapports-tipster-chatgpt`, pour ne pas mélanger ses rapports à ceux du robot existant.

Le profil ChatGPT utilisera un compte robot distinct (`chatgpt-tipster@betwise.invalid`) et une bankroll virtuelle séparée. Ce compte est créé automatiquement lors du premier passage actif. Il n'a pas de mot de passe ni de connexion manuelle.

## Paramétrage nécessaire avant l'activation

Dans GitHub : **Settings → Secrets and variables → Actions**.

Ajouter :
- Secret `OPENAI_API_KEY` : clé API OpenAI.
- Variable `OPENAI_TIPSTER_MODEL` : identifiant exact d'un modèle disponible dans le projet API.

Les secrets Supabase et l'identifiant administrateur déjà utilisés par les workflows BETWISE restent nécessaires.

### Coût et essai

- La clé API n'est pas incluse dans l'abonnement ChatGPT.
- Le workflow planifié restera sans appel API tant que la clé et la variable modèle ne sont pas renseignées.
- L'action manuelle `workflow_dispatch` avec `essai=true` ne fait aucune écriture Supabase, **mais l'appel au modèle est tout de même facturé**.
- Aucun abonnement, crédit API ou plafond de dépense n'a été créé ou modifié par cette préparation.

## Protocole du profil ChatGPT

1. Récupérer les matchs à venir et les signaux/cotes disponibles dans BETWISE.
2. Écarter les matchs commencés, les cotes 1xBet absentes ou périmées, les relevés de référence non contemporains et les cotes hors périmètre.
3. Constituer un dossier borné et ordonné de candidats. Le préfiltrage actuel retient jusqu'à 120 candidats selon l'écart mécanique avec la probabilité de marché ; ce choix est documenté et doit être conservé comme version de protocole.
4. Envoyer le dossier à l'API sans outil de recherche web.
5. Accepter uniquement des identifiants de candidats présents dans le dossier ; ignorer les doublons ou les identifiants inventés.
6. Appliquer les règles BETWISE existantes : abstention possible, simples virtuels, limites journalières, seuils de risque, mise et bankroll.
7. Enregistrer le pronostic dans la source privée « ChatGPT · tipster virtuel » et le pari test dans son compte robot distinct.
8. Garder dans le rapport le modèle API, la version du prompt, les cotes et leurs heures de relevé, la décision et les raisons.

Les choix de ChatGPT ne sont pas garantis gagnants. La probabilité annoncée est une estimation du modèle et sera évaluée sur l'historique.

## Fusion avec Claude : ce qui reste indispensable

Fusion ne doit pas être simulée par un seul modèle qui prétend représenter deux avis indépendants.

Pour une vraie Fusion automatisée, il faut :
1. un accès automatisable à Claude (API Anthropic ou autre mécanisme officiellement autorisé) ;
2. un dossier de données unique, horodaté et identique pour les deux modèles ;
3. les choix indépendants de ChatGPT et Claude verrouillés avant toute discussion ;
4. un tour de critique écrit de chaque côté ;
5. une règle déterministe : un choix Fusion n'est retenu que si les deux l'acceptent après l'échange ; sinon abstention ;
6. une source et une bankroll virtuelles distinctes pour Fusion.

**Claude Pro ne fournit pas automatiquement une clé API Anthropic.** Une clé API et une facturation API séparée peuvent être nécessaires. La clé ne doit jamais être placée dans le dépôt.

Le robot actuellement déployé sous le nom « Tipster virtuel (Claude) » applique une stratégie codée dans `src/lib/tipster-virtuel/strategie.ts`. Il ne faut donc pas le présenter comme une décision quotidienne d'un modèle Claude. Dans la première phase, il demeure une référence mécanique tant qu'une véritable exécution Claude n'est pas mise en place.

La Fusion n'est pas encore activée ni créée par ce changement : elle nécessite le dossier commun et les accès modèles ci-dessus. Le profil et le compte Fusion sont prévus, mais ne doivent pas être créés avec des paris fictifs ou des choix non validés.

## Limites et sécurité

- Aucun pari réel, aucune connexion à un bookmaker.
- Aucune recherche web pendant le benchmark.
- Aucun choix non présent dans le dossier ne peut être enregistré.
- Aucun secret n'est stocké dans le code ou dans les rapports.
- Les tâches GitHub peuvent démarrer en retard ; les horaires cron sont des horaires prévus, pas des garanties d'exécution exacte.
- La préparation doit passer par revue/CI avant fusion. Elle n'a modifié ni `main`, ni le déploiement, ni la base de production.
