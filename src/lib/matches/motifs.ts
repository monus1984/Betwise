/** Motifs d'absence d'API-Football (en anglais) traduits pour l'écran Stats. Motif inconnu : affiché tel quel. */
const MOTIFS: [RegExp, string][] = [
  [/^red card$/i, "carton rouge"], [/^yellow cards?$/i, "cumul de cartons"], [/suspend/i, "suspendu"],
  [/^illness$|^sick/i, "malade"], [/^international duty$/i, "sélection nationale"], [/^personal reasons?$/i, "raisons personnelles"],
  [/^coach'?s decision$/i, "choix de l’entraîneur"], [/^lack of fitness$|^fitness$/i, "manque de condition"], [/^rest$/i, "repos"],
  [/^broken/i, "fracture"], [/concussion/i, "commotion"], [/knock/i, "coup"], [/^surgery$/i, "opération"],
];
const PARTIES: [RegExp, string][] = [
  [/hamstring/i, "ischios"], [/knee/i, "genou"], [/ankle/i, "cheville"], [/thigh/i, "cuisse"], [/calf/i, "mollet"], [/groin/i, "aine"],
  [/muscle/i, "musculaire"], [/back/i, "dos"], [/foot/i, "pied"], [/shoulder/i, "épaule"], [/hip/i, "hanche"], [/achilles/i, "tendon d’Achille"],
  [/ligament/i, "ligaments"], [/head/i, "tête"], [/toe/i, "orteil"], [/hand|wrist/i, "main"], [/adductor/i, "adducteurs"], [/abdominal/i, "abdominaux"],
];

export function motifFr(motif: string | null | undefined): string | null {
  if (!motif) return null;
  const m = motif.trim();
  for (const [re, fr] of MOTIFS) if (re.test(m)) return fr;
  if (/injur|strain|problem|tear|sprain/i.test(m)) {
    const partie = PARTIES.find(([re]) => re.test(m));
    return partie ? `blessure (${partie[1]})` : "blessure";
  }
  return m;
}
