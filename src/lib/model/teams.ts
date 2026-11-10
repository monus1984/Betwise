/**
 * Rapprochement des noms d'équipes entre football-data.co.uk (historique) et
 * football-data.org (calendrier en base). Aucune création d'équipe : si un nom
 * ne se rapproche pas, le match est ignoré et signalé dans le journal du job.
 */

const NOISE = new Set(["fc", "afc", "cf", "cfc", "acf", "ac", "as", "ss", "ssc", "us", "sc", "sv", "vfb", "vfl", "tsg", "rb", "rc", "rcd", "ca", "ud", "cd", "club", "de", "da", "del", "la", "calcio", "balompie", "bc", "hsc", "1", "04", "05", "07", "09", "29", "98", "1846", "1848", "1899", "1901", "1907", "1909", "1910", "1913", "fsv", "sco", "osc", "ogc", "es", "aj", "olympique", "stade", "racing", "futbol"]);

// Noms abrégés de football-data.co.uk qui ne se déduisent pas du nom officiel.
const OVERRIDES: Record<string, string> = {
  // Angleterre
  "man united": "manchester united", "man city": "manchester city", "nott'm forest": "nottingham forest", "wolves": "wolverhampton", "spurs": "tottenham",
  // Espagne
  "ath bilbao": "athletic club", "ath madrid": "atletico madrid", "betis": "real betis", "sociedad": "real sociedad", "espanol": "espanyol", "vallecano": "rayo vallecano", "la coruna": "deportivo la coruna",
  // Italie
  "inter": "internazionale", "milan": "ac milan", "verona": "hellas verona", "roma": "as roma",
  // Allemagne
  "bayern munich": "bayern munchen", "ein frankfurt": "eintracht frankfurt", "fc koln": "koln", "m'gladbach": "monchengladbach", "leverkusen": "bayer leverkusen", "hamburg": "hamburger", "kiel": "holstein kiel", "st pauli": "st. pauli",
  // France
  "paris sg": "paris saint-germain", "lyon": "olympique lyonnais", "marseille": "olympique de marseille", "rennes": "stade rennais", "brest": "stade brestois", "st etienne": "saint-etienne",
};

export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9' .-]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string) {
  return new Set(normalize(s).replace(/[.'-]/g, " ").split(" ").filter((t) => t && !NOISE.has(t)));
}
function signature(s: string) {
  const n = normalize(s);
  const o = OVERRIDES[n];
  return tokens(o ?? n);
}

/** Pour chaque nom football-data.co.uk, l'id de l'équipe en base, ou null. */
export function buildTeamMap(historyNames: string[], dbTeams: { id: string; nom: string; alias: string[] }[]) {
  const map = new Map<string, string | null>();
  const sigs = dbTeams.map((t) => ({ id: t.id, fulls: [t.nom, ...t.alias].map(normalize), sigs: [signature(t.nom), ...t.alias.map(signature)] }));
  for (const name of historyNames) {
    const want = signature(name);
    const wantFull = normalize(OVERRIDES[normalize(name)] ?? name);
    const best: { id: string; score: number }[] = [];
    for (const t of sigs) {
      // 1) nom complet contenu (ex. "internazionale" dans "fc internazionale milano")
      // nom identique (ex. "Paris FC", alors que le PSG porte l'alias « Paris »)
      if (t.fulls.some((f) => f === wantFull)) { best.push({ id: t.id, score: 120 }); continue; }
      // signature identique (ex. "barcelona" = FC Barcelona, pas RCD Espanyol de Barcelona) ; le nom officiel passe avant les alias
      const same = (sg: Set<string>) => sg.size > 0 && sg.size === want.size && [...want].every((x) => sg.has(x));
      if (same(t.sigs[0])) { best.push({ id: t.id, score: 100 }); continue; }
      if (t.sigs.slice(1).some(same)) { best.push({ id: t.id, score: 95 }); continue; }
      if (t.fulls.some((f) => f.includes(wantFull))) { best.push({ id: t.id, score: 80 }); continue; }
      for (const sg of t.sigs) {
        if (sg.size === 0 || want.size === 0) continue;
        const inter = [...want].filter((x) => sg.has(x)).length;
        if (inter === want.size && inter === sg.size) best.push({ id: t.id, score: 90 });
        else if (inter === want.size) best.push({ id: t.id, score: 50 - (sg.size - inter) });
      }
    }
    best.sort((a, b) => b.score - a.score);
    const top = best[0];
    const tie = best.length > 1 && best[1].score === top?.score && best[1].id !== top.id;
    map.set(name, top && !tie ? top.id : null);
  }
  return map;
}
