/**
 * Registre des compétitions affichées : nom court, drapeau, pays (regroupement de l'écran Matchs) et ordre.
 * Ajouter une compétition ici ne l'importe pas : l'import se règle dans src/lib/api-football/sync.ts (AF_COMPETITIONS)
 * ou src/lib/football-data/client.ts.
 */
export type CompInfo = { court: string; drapeau: string; pays: string; majeure?: boolean };

/** Ordre des groupes de l'écran Matchs. Les pays non listés suivent, par ordre alphabétique. */
export const PAYS_ORDRE = ["International", "Europe", "Afrique", "Côte d'Ivoire", "France", "Angleterre", "Espagne", "Italie", "Allemagne"];

export const COMPETITIONS: Record<string, CompInfo> = {
  // sélections et coupes
  CANQ: { court: "Éliminatoires CAN", drapeau: "🌍", pays: "Afrique", majeure: true },
  AMI: { court: "Amicaux internationaux", drapeau: "🤝", pays: "International" },
  UNL: { court: "Ligue des nations", drapeau: "🇪🇺", pays: "Europe", majeure: true },
  CL: { court: "Ligue des champions", drapeau: "⭐", pays: "Europe", majeure: true },
  EL: { court: "Ligue Europa", drapeau: "🟠", pays: "Europe", majeure: true },
  ECL: { court: "Ligue Conférence", drapeau: "🟢", pays: "Europe" },
  UWCL: { court: "Ligue des champions féminine", drapeau: "⭐", pays: "Europe" },
  CAFCL: { court: "Ligue des champions CAF", drapeau: "🏆", pays: "Afrique", majeure: true },
  CAFCC: { court: "Coupe de la confédération", drapeau: "🏆", pays: "Afrique" },
  // championnats
  CIV1: { court: "Ligue 1 ivoirienne", drapeau: "🇨🇮", pays: "Côte d'Ivoire", majeure: true },
  FL1: { court: "Ligue 1", drapeau: "🇫🇷", pays: "France", majeure: true },
  FL2: { court: "Ligue 2", drapeau: "🇫🇷", pays: "France" },
  PL: { court: "Premier League", drapeau: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pays: "Angleterre", majeure: true },
  ELC: { court: "Championship", drapeau: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pays: "Angleterre" },
  PD: { court: "Liga", drapeau: "🇪🇸", pays: "Espagne", majeure: true },
  SD: { court: "Liga 2", drapeau: "🇪🇸", pays: "Espagne" },
  SA: { court: "Serie A", drapeau: "🇮🇹", pays: "Italie", majeure: true },
  SB: { court: "Serie B", drapeau: "🇮🇹", pays: "Italie" },
  BL1: { court: "Bundesliga", drapeau: "🇩🇪", pays: "Allemagne", majeure: true },
  BL2: { court: "2. Bundesliga", drapeau: "🇩🇪", pays: "Allemagne" },
  BE1: { court: "Belgique D1", drapeau: "🇧🇪", pays: "Belgique" },
  BE2: { court: "Belgique D2", drapeau: "🇧🇪", pays: "Belgique" },
  NL1: { court: "Eredivisie", drapeau: "🇳🇱", pays: "Pays-Bas" },
  NL2: { court: "Eerste Divisie", drapeau: "🇳🇱", pays: "Pays-Bas" },
  TR1: { court: "Süper Lig", drapeau: "🇹🇷", pays: "Turquie" },
  TR2: { court: "Turquie D2", drapeau: "🇹🇷", pays: "Turquie" },
  DK1: { court: "Superliga danoise", drapeau: "🇩🇰", pays: "Danemark" },
  NO1: { court: "Eliteserien", drapeau: "🇳🇴", pays: "Norvège" },
  KSA1: { court: "Saudi Pro League", drapeau: "🇸🇦", pays: "Arabie saoudite" },
  ENG3: { court: "League One", drapeau: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pays: "Angleterre" },
  ENGF: { court: "WSL (féminine)", drapeau: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", pays: "Angleterre" },
  FRAF: { court: "D1 féminine", drapeau: "🇫🇷", pays: "France" },
  GERF: { court: "Bundesliga féminine", drapeau: "🇩🇪", pays: "Allemagne" },
  ESPF: { court: "Liga F (féminine)", drapeau: "🇪🇸", pays: "Espagne" },
  ITAF: { court: "Serie A féminine", drapeau: "🇮🇹", pays: "Italie" },
  PT1: { court: "Liga Portugal", drapeau: "🇵🇹", pays: "Portugal" },
  SC1: { court: "Premiership écossaise", drapeau: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", pays: "Écosse" },
  CH1: { court: "Super League suisse", drapeau: "🇨🇭", pays: "Suisse" },
  AT1: { court: "Bundesliga autrichienne", drapeau: "🇦🇹", pays: "Autriche" },
  GR1: { court: "Super League grecque", drapeau: "🇬🇷", pays: "Grèce" },
  RO1: { court: "Liga I roumaine", drapeau: "🇷🇴", pays: "Roumanie" },
  QA1: { court: "Qatar Stars League", drapeau: "🇶🇦", pays: "Qatar" },
};

const rangPays = (p: string) => { const i = PAYS_ORDRE.indexOf(p); return i === -1 ? PAYS_ORDRE.length : i; };

/** Tri des pays : ordre fixe d'abord, puis alphabétique. */
export function comparerPays(a: string, b: string) {
  return rangPays(a) - rangPays(b) || a.localeCompare(b, "fr");
}

/** Ordre global des compétitions (pays, puis ordre de déclaration dans le pays). */
export const COMP_ORDRE = Object.keys(COMPETITIONS).sort((a, b) => comparerPays(COMPETITIONS[a].pays, COMPETITIONS[b].pays) || Object.keys(COMPETITIONS).indexOf(a) - Object.keys(COMPETITIONS).indexOf(b));
