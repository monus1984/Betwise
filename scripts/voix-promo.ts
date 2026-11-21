/** Voix off de la vidéo de démonstration par la voix Google de l'application (5 demandes, quota gratuit : 10 par jour). */
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const ORIGINE = "https://betwise-iota.vercel.app";
const CLE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const GROUPES = [
  "Parier sans analyser, c'est jouer à l'aveugle. Voici Betwise.\n\nBetster, ton coach IA, analyse chaque jour les matchs à venir et te les explique à voix haute.\n\nIl te propose ses coups du jour en trois profils : prudent, équilibré, audacieux.",
  "Tu cherches des choix entre 70 et 80 % ? Choisis ta fourchette.\n\nPlus de quarante compétitions : les tops matchs, le direct, les classements.\n\nMets un match en favori : chaque but t'arrive en notification.",
  "Sur chaque match : l'enjeu, la forme, les probabilités marché par marché, et les cotes One X Bet et Betclic.\n\nPrends ton ticket en photo, filme ton écran ou dicte-le : Betwise le lit, le suit et le règle automatiquement.",
  "Avec les paris test, tu joues sans argent réel et tu découvres les types de paris sur lesquels tu es vraiment performant.\n\nDans Sources, charge les coupons des pronostiqueurs que tu suis : un tableau de bord te montre les paris sur lesquels ils sont performants.\n\nAjoute le lien de leur page, et rejoins-la en un clic depuis Betwise.",
  "Côté coach : ta bankroll, ton budget de la semaine, et une alerte quand tu t'emballes.\n\nCrée tes montantes, palier par palier : Betwise te propose les choix les plus probables pour les construire.",
  "Et parle à Betster, à l'écrit ou à la voix : demande-lui les paris les plus probables, un combiné, ou le bilan de ta façon de parier.\n\nBetwise. Comprends. Teste. Maîtrise.",
  "Le compagnon du parieur, pour analyser les matchs, suivre tes paris et gérer ta bankroll.",
];
async function main() {
  mkdirSync("voix-promo", { recursive: true });
  const seuls = (process.env.GROUPES ?? "").split(",").filter(Boolean).map(Number);
  for (const [i, text] of GROUPES.entries()) {
    if (seuls.length && !seuls.includes(i + 1)) continue;
    const t = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", CLE).update(`${t}.${text}`).digest("hex");
    const r = await fetch(`${ORIGINE}/api/voix-google`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, t, sig }) });
    if (!r.ok) { console.log(`GROUPE ${i + 1} : échec ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
    const b = Buffer.from(await r.arrayBuffer());
    writeFileSync(`voix-promo/g${i + 1}.wav`, b);
    console.log(`GROUPE ${i + 1} : ${b.length} octets`);
    await new Promise((x) => setTimeout(x, 8000));
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
