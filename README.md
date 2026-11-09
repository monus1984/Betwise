# BETWISE

Plateforme de suivi des paris, de notation des sources de pronostics et de coaching.
Prototype V1 pour ~20 testeurs. Spécification : document « BETWISE — Architecture fonctionnelle & modèle de données V0.1 ».

## Stack

Next.js 15 · TypeScript · Tailwind · Supabase (schéma `betwise` du projet arbitre-finance) · Vercel · GitHub Actions (jobs) · API Claude (coach, extraction).

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run import:matches        # remplit le référentiel matchs
npm run dev
```

## Structure

```
src/app/                 pages et routes (App Router)
src/lib/supabase/        clients navigateur / serveur / service_role, types du schéma betwise
src/lib/football-data/   client API football-data.org + synchronisation
scripts/                 jobs exécutés par GitHub Actions
supabase/migrations/     SQL appliqué, dans l'ordre (source de vérité)
```

## Règles du projet

- Toute requête Supabase cible le schéma `betwise` ; `public` appartient à Kehiwa, on n'y touche pas.
- Les clés vivent dans les variables d'environnement, jamais dans le code ni dans un chat.
- Le LLM ne calcule aucun chiffre : il appelle des fonctions et explique leurs retours.
- Une migration appliquée est copiée telle quelle dans `supabase/migrations/`.

## Phases

0. Fondations — schéma, auth, import des matchs (en cours)
1. Socle — saisie des paris, bankroll, sources et pronos, règlement automatique
2. Intelligence — extraction, indicateurs des sources, modèle de risque, coach
3. Test et automatisation — 20 testeurs, bot Telegram, jobs horaires, retours in-app
