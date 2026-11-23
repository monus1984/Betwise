/**
 * Console IA (23/11) : les modèles proposés, et les projets de Mounir (BETWISE, Kehiwa, autres).
 * Les capacités (image, audio) et les prix viennent de la liste publique d'OpenRouter, relue toutes les heures.
 */
export type ModeleConsole = { id: string; nom: string; groupe: "grands" | "eco" | "gratuits"; fournisseur: "openrouter" | "anthropic" };

export const MODELES: ModeleConsole[] = [
  { id: "anthropic:claude-sonnet-5-5", nom: "Claude Sonnet", groupe: "grands", fournisseur: "anthropic" },
  { id: "openai/gpt-6.2-sol", nom: "ChatGPT", groupe: "grands", fournisseur: "openrouter" },
  { id: "google/gemini-4-carbon", nom: "Gemini", groupe: "grands", fournisseur: "openrouter" },
  { id: "x-ai/grok-4.7", nom: "Grok", groupe: "grands", fournisseur: "openrouter" },
  { id: "deepseek/deepseek-v4.1-flash-1017", nom: "DeepSeek", groupe: "eco", fournisseur: "openrouter" },
  { id: "anthropic/claude-haiku-5.5", nom: "Claude Haiku", groupe: "eco", fournisseur: "openrouter" },
  { id: "openai/gpt-6-luna", nom: "GPT Luna", groupe: "eco", fournisseur: "openrouter" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", nom: "Nemotron (gratuit)", groupe: "gratuits", fournisseur: "openrouter" },
  { id: "openrouter/free", nom: "Routeur gratuit", groupe: "gratuits", fournisseur: "openrouter" },
];
export const GROUPES = { grands: "Grands modèles", eco: "Économiques", gratuits: "Gratuits (moins fiables)" } as const;

export const PROJETS: Record<string, { nom: string; contexte: string }> = {
  betwise: { nom: "BETWISE", contexte: "Projet BETWISE : application web mobile (PWA Next.js 15 + Supabase + Vercel) d'analyse de paris sportifs, de suivi des paris et de notation des tipsters, avec un personnage IA, Betster, et un Coach. Une vingtaine de testeurs à Abidjan. Dépôt GitHub monus1984/Betwise." },
  kehiwa: { nom: "Kehiwa", contexte: "Projet Kehiwa : assistant financier personnel (PWA React + Supabase + Vercel). Dépôt GitHub monus1984/Kehiwa." },
  autre: { nom: "Autre", contexte: "" },
};

/** Prix Claude Sonnet par l'API Anthropic (en $ par jeton), pour afficher le coût. */
export const PRIX_SONNET = { entree: 2e-6, sortie: 1e-5 };

export type PieceJointe = { type: "image"; nom: string; dataUrl: string } | { type: "texte"; nom: string; contenu: string };

/** Message de l'utilisateur au format compatible OpenAI (texte + images). */
export function contenuOpenAI(question: string, contexte: string, pieces: PieceJointe[]) {
  const textes = pieces.filter((p): p is Extract<PieceJointe, { type: "texte" }> => p.type === "texte").map((p) => `--- Fichier ${p.nom} ---\n${p.contenu}`);
  const texte = [contexte, question, ...textes].filter(Boolean).join("\n\n");
  const images = pieces.filter((p): p is Extract<PieceJointe, { type: "image" }> => p.type === "image");
  return images.length ? [{ type: "text", text: texte }, ...images.map((i) => ({ type: "image_url", image_url: { url: i.dataUrl } }))] : texte;
}

export const SYSTEME_CONSOLE = "Tu fais partie d'un conseil de plusieurs IA consulté par Mounir, porteur de projets à Abidjan. Réponds en français, de façon concrète, structurée et honnête : dis ce qui est juste, ce qui est faux ou manquant, et quand tu as un doute. Pas de flatterie. Sois concis, sauf si on te demande un travail long.";
