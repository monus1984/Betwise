import Link from "next/link";
import { CoachNav } from "@/components/coach-nav";
import { PageHeader } from "@/components/page-header";
import { fcfa } from "@/components/ui";
import { Montant } from "@/components/montant";
import { createClient } from "@/lib/supabase/server";
import { STATUT_FR, etat, type Palier } from "@/lib/montantes/regles";
import { NouvelleMontante } from "./nouvelle";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Montantes (19/11) : une mise de départ, un objectif, des paliers ; chaque palier est un pari réel. */
export default async function MontantesPage() {
  const db = await createClient();
  const [{ data: ms }, { data: bs }] = await Promise.all([
    db.from("montantes").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("bets").select("montante_id, palier, mise, cote_totale, statut, gain_net").not("montante_id", "is", null),
  ]);
  const lignes = (ms ?? []).map((m) => {
    const paliers: Palier[] = (bs ?? []).filter((b) => b.montante_id === m.id).map((b) => ({ palier: Number(b.palier), mise: Number(b.mise), cote: b.cote_totale === null ? null : Number(b.cote_totale), statut: b.statut, gain_net: b.gain_net === null ? null : Number(b.gain_net) }));
    return { m, e: etat({ ...m, mise_depart: Number(m.mise_depart), objectif: Number(m.objectif) }, paliers) };
  });
  return (
    <>
      <PageHeader title="Coach" subtitle="Montantes : tu réinvestis le gain de chaque palier pour viser un objectif." />
      <CoachNav current="montantes" />
      <NouvelleMontante ouverte={lignes.length === 0} />
      {lignes.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {lignes.map(({ m, e }) => (
            <li key={m.id}>
              <Link href={`/montantes/${m.id}`} className="tile block p-3.5 active:bg-surface-2">
                <span className="flex items-baseline justify-between gap-2"><span className="min-w-0 truncate text-[15px] font-bold">{m.nom}</span><span className={`shrink-0 text-[11.5px] font-semibold ${e.statut === "atteinte" ? "text-gain" : e.statut === "cassee" ? "text-loss" : "text-ink-soft"}`}>{STATUT_FR[e.statut]}</span></span>
                <span className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  {Array.from({ length: m.paliers_prevus }, (_, i) => { const p = e.paliers[i]; return <span key={i} className={`flex-1 border-r-2 border-surface last:border-r-0 ${p?.statut === "gagne" ? "bg-gain" : p?.statut === "perdu" ? "bg-loss" : p?.statut === "en_cours" ? "bg-draw" : ""}`} />; })}
                </span>
                <span className="mt-1.5 flex justify-between text-[12px] text-ink-soft">
                  <span>{e.gagnes} palier{e.gagnes > 1 ? "s" : ""} sur {m.paliers_prevus} · capital <Montant texte={fcfa(e.capital)} /></span>
                  <span>objectif <Montant texte={fcfa(Number(m.objectif))} /></span>
                </span>
                {e.chanceJuste !== null && <span className="mt-1 block text-[11.5px] text-ink-muted">Environ {pct(e.chanceJuste)} de chances d’aller au bout d’après les cotes, un peu moins avec la marge du bookmaker.</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
