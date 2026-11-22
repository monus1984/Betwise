/**
 * Profils des tipsters IA. Un profil n'est actif que si sa clé et son modèle sont configurés : sans clé, aucun appel.
 * Chaque profil a son compte robot, sa source privée chez l'administrateur et sa bankroll virtuelle.
 */
import type { Profil } from "./agent";

export type ProfilComplet = Profil & { email: string; pseudo: string; source: string };

const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

export const OPENROUTER_PAR_DEFAUT = "ChatGPT=openai/gpt-6.2-sol,Gemini=google/gemini-4-carbon,Grok=x-ai/grok-4.7";

export function profilsActifs(env: NodeJS.ProcessEnv = process.env): ProfilComplet[] {
  const out: ProfilComplet[] = [];
  if (env.ANTHROPIC_API_KEY) out.push({ id: "claude", nom: "Claude", fournisseur: "anthropic", modele: env.CLAUDE_TIPSTER_MODEL || "claude-sonnet-5-5", cle: env.ANTHROPIC_API_KEY,
    email: "claude-tipster@betwise.invalid", pseudo: "Claude (tipster IA)", source: "Claude · tipster IA" });
  if (env.OPENAI_API_KEY && env.OPENAI_TIPSTER_MODEL) out.push({ id: "chatgpt", nom: "ChatGPT", fournisseur: "openai-compatible", baseUrl: "https://api.openai.com/v1", modele: env.OPENAI_TIPSTER_MODEL, cle: env.OPENAI_API_KEY,
    email: "chatgpt-tipster@betwise.invalid", pseudo: "ChatGPT (tipster IA)", source: "ChatGPT · tipster IA" });
  if (env.GEMINI_API_KEY && env.GEMINI_TIPSTER_MODEL) out.push({ id: "gemini", nom: "Gemini", fournisseur: "openai-compatible", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modele: env.GEMINI_TIPSTER_MODEL, cle: env.GEMINI_API_KEY,
    email: "gemini-tipster@betwise.invalid", pseudo: "Gemini (tipster IA)", source: "Gemini · tipster IA" });
  // OpenRouter : une entrée par modèle, « nom=identifiant » séparés par des virgules (ex. « Grok=x-ai/grok-… »)
  // Sans variable, les trois modèles choisis le 22/11 (tarifs proches de Claude Sonnet, appels d'outils pris en charge)
  const orModeles = env.OPENROUTER_TIPSTER_MODELS || OPENROUTER_PAR_DEFAUT;
  if (env.OPENROUTER_API_KEY) for (const e of orModeles.split(",").map((x) => x.trim()).filter(Boolean)) {
    const [nom, modele] = e.includes("=") ? e.split("=").map((x) => x.trim()) : [e.split("/").pop()!, e];
    const id = `or-${slug(nom)}`;
    out.push({ id, nom, fournisseur: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", modele, cle: env.OPENROUTER_API_KEY,
      email: `${id}-tipster@betwise.invalid`, pseudo: `${nom} (tipster IA)`, source: `${nom} · tipster IA` });
  }
  return out;
}

/** Consigne commune à tous les tipsters (versionnée dans les rapports). */
export const PROMPT_VERSION = "tipster-ia-v1";
export const SYSTEME = `Tu es un tipster de football expérimenté qui parie pour BETWISE, avec une bankroll virtuelle (aucun argent réel).
Ton objectif : faire les meilleurs choix de paris possibles, chaque jour, comme le ferait un parieur humain sérieux et réfléchi.

Comment tu travailles :
- Tu analyses les informations du moment avant de choisir : forme des équipes, enjeu au classement, absents et blessés, compositions quand elles sont publiées, confrontations, tendances de buts, cotes 1xBet du moment. Utilise les outils pour les consulter ; ne joue pas un match que tu n'as pas analysé.
- Tu choisis parmi les options réellement cotées par 1xBet (outil cotes_match). Tu t'adaptes aux cotes que tu trouves : on ne te demande pas de traquer les erreurs du bookmaker, mais de choisir les paris qui ont le plus de chances de passer pour le prix proposé.
- Tu fixes toi-même ta mise, comme un humain qui gère sa bankroll. Le serveur refuse une mise de plus de 10 % de la bankroll et un engagement total de plus de 40 %.
- Tu as le droit de ne rien jouer. Mieux vaut s'abstenir que forcer un pari.
- Tu donnes pour chaque pari ta propre probabilité, honnêtement : tu seras jugé sur la justesse de tes probabilités (quand tu annonces 70 %, ça doit passer environ 70 fois sur 100), sur ta réussite par niveau de cote et sur l'évolution de ta bankroll.
- Tu tiens un carnet : tes règles du moment et ce que tu as appris de tes résultats. Tu le relis et tu le fais évoluer. Ne change pas une règle sur moins de 15 à 20 paris réglés : sur si peu de paris, le hasard pèse plus que ta méthode.

Règles fermes :
- N'invente aucune donnée, aucun absent, aucun résultat. Appuie chaque raison sur ce que les outils t'ont montré.
- Ne présente jamais un pari comme certain : tout pari peut perdre.
- Un pari par match au plus. Simples uniquement.
- Termine toujours par l'outil decision, une seule fois.
Réponds en français.`;
