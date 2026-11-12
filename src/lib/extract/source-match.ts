/** Rapprochement du nom lu sur une capture (canal, page, groupe) avec les sources BETWISE. Utilisable côté navigateur. */
const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
/** Source existante qui correspond au nom lu sur la capture (nom identique, inclus, ou mots très proches). */
export function matchSource<T extends { id: string; nom: string; type?: string }>(name: string | null | undefined, sources: T[]): T | null {
  if (!name) return null;
  const n = norm(name);
  if (n.length < 2) return null;
  const pool = sources.filter((s) => s.type !== "perso" && s.type !== "modele_betwise");
  const exact = pool.find((s) => norm(s.nom) === n);
  if (exact) return exact;
  const words = (x: string) => new Set(x.split(" ").filter((w) => w.length > 1));
  let best: { s: T; sc: number } | null = null;
  for (const s of pool) {
    const m = norm(s.nom);
    let sc = 0;
    if (m.length >= 4 && n.length >= 4 && (m.includes(n) || n.includes(m)) && Math.min(m.length, n.length) / Math.max(m.length, n.length) >= 0.5) sc = 0.85;
    else { const a = words(n), b = words(m); const inter = [...a].filter((w) => b.has(w)).length; sc = inter / Math.max(1, Math.max(a.size, b.size)); }
    if (sc >= 0.67 && (!best || sc > best.sc)) best = { s, sc };
  }
  return best?.s ?? null;
}
/** Type de source BETWISE pour une plateforme lue sur la capture. */
export const SOURCE_TYPE_OF: Record<string, string> = { telegram: "canal_telegram", facebook: "page_facebook", instagram: "compte_instagram", whatsapp: "tipster", tiktok: "tipster", autre: "tipster" };
