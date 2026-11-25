import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachNav } from "@/components/coach-nav";
import { PageHeader } from "@/components/page-header";
import { fcfa } from "@/components/ui";
import { Montant } from "@/components/montant";
import { AddToSlip } from "@/components/slip";
import { cote as fc, heure, jourCourt, pct } from "@/components/proposition";
import { createClient } from "@/lib/supabase/server";
import { STATUT_FR, etat, pourLePalier, type Palier } from "@/lib/montantes/regles";
import { loadOptions } from "@/lib/options/load";
import { legFrom } from "@/lib/slip/leg";
import { Arreter, Detacher, ModifierSupprimer, Rattacher, Reprendre } from "./boutons";

export const dynamic = "force-dynamic";

export default async function MontantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: m } = await db.from("montantes").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();
  const [{ data: bs }, { data: libres }] = await Promise.all([
    db.from("bets").select("id, palier, mise, cote_totale, statut, gain_net, placed_at, nb_selections").eq("montante_id", id).order("palier"),
    db.from("bets").select("id, mise, cote_totale, statut, placed_at, nb_selections, virtuel").is("montante_id", null).neq("statut", "annule").gte("placed_at", new Date(Date.parse(m.created_at) - 3600000).toISOString()).order("placed_at", { ascending: false }).limit(8),
  ]);
  const paliers: Palier[] = (bs ?? []).map((b) => ({ palier: Number(b.palier), mise: Number(b.mise), cote: b.cote_totale === null ? null : Number(b.cote_totale), statut: b.statut, gain_net: b.gain_net === null ? null : Number(b.gain_net) }));
  const e = etat({ ...m, mise_depart: Number(m.mise_depart), objectif: Number(m.objectif) }, paliers);
  // Le statut enregistré suit les paris réglés (atteinte, cassée) ; jamais l'inverse
  if (m.statut === "en_cours" && (e.statut === "atteinte" || e.statut === "cassee")) {
    await db.from("montantes").update({ statut: e.statut, termine_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("statut", "en_cours");
  }
  const options = e.coteParPalier ? pourLePalier((await loadOptions(db, "48h")).options, e.coteParPalier) : [];
  const fini = e.statut !== "en_cours";

  return (
    <>
      <PageHeader title={m.nom} subtitle={`${STATUT_FR[e.statut]} · ${m.paliers_prevus} paliers prévus`} action={<Link href="/montantes">Toutes</Link>} />
      <CoachNav current="montantes" />

      <section className="card-hero rounded-[22px] p-4">
        <div className="flex items-end justify-between gap-3">
          <div><span className="block text-[12px] text-ink-soft">Capital du palier {Math.min(e.prochainPalier, m.paliers_prevus)}</span><Montant texte={fcfa(e.capital)} className="block text-[30px] font-extrabold leading-tight tabular-nums" /></div>
          <div className="text-right"><span className="block text-[12px] text-ink-soft">Objectif</span><Montant texte={fcfa(Number(m.objectif))} className="block text-[17px] font-bold" /></div>
        </div>
        <ol className="mt-3 flex gap-1.5" aria-label="Paliers">
          {Array.from({ length: m.paliers_prevus }, (_, i) => { const p = e.paliers[i]; return (
            <li key={i} className={`flex h-9 flex-1 items-center justify-center rounded-lg text-[12px] font-bold ${p?.statut === "gagne" ? "bg-gain text-on-fill" : p?.statut === "perdu" ? "bg-loss text-on-fill" : p?.statut === "en_cours" ? "bg-draw text-on-fill" : p?.statut === "rembourse" ? "bg-surface-2 text-ink-soft" : "border border-dashed border-line text-ink-muted"}`}>{i + 1}</li>
          ); })}
        </ol>
        {e.chanceJuste !== null && <p className="mt-3 text-[12px] leading-snug text-ink-soft">D’après les cotes, environ <b className="text-ink">{pct(e.chanceJuste)}</b> de chances d’atteindre l’objectif, un peu moins avec la marge du bookmaker. Un palier perdu, et le capital en jeu est perdu.</p>}
        {e.statut === "atteinte" && <p className="mt-3 text-[13px] font-semibold text-gain">Objectif atteint en {e.gagnes} palier{e.gagnes > 1 ? "s" : ""}.</p>}
        {e.statut === "cassee" && <p className="mt-3 text-[13px] font-semibold text-loss">Le palier {e.paliers.find((p) => p.statut === "perdu")?.palier} a perdu : la montante s’arrête là.</p>}
      </section>

      {e.paliers.length > 0 && (
        <section className="tile mt-4 p-3.5" aria-label="Paliers joués">
          <h2 className="text-[15px] font-bold">Paliers joués</h2>
          <ul className="mt-1 divide-y divide-line">
            {(bs ?? []).map((b, i, all) => (
              <li key={b.id}><Link href={`/paris/${b.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <span>Palier {b.palier} · {b.nb_selections && b.nb_selections > 1 ? `combiné de ${b.nb_selections}` : "simple"}{b.cote_totale ? ` · cote ${fc(Number(b.cote_totale))}` : ""}</span>
                <span className={`font-semibold ${b.statut === "gagne" ? "text-gain" : b.statut === "perdu" ? "text-loss" : "text-ink-soft"}`}><Montant texte={fcfa(Number(b.mise))} /> · {b.statut === "gagne" ? "gagné" : b.statut === "perdu" ? "perdu" : b.statut === "rembourse" ? "remboursé" : "en cours"}</span>
              </Link>{i === all.length - 1 && <Detacher montanteId={id} betId={b.id} />}</li>
            ))}
          </ul>
        </section>
      )}

      {!fini && e.enCours && <p className="mt-4 rounded-xl bg-draw-soft p-3 text-[12.5px] text-draw-ink">Le palier {e.enCours.palier} est en cours. Le suivant se prépare dès qu’il est réglé.</p>}

      {!fini && !e.enCours && e.coteParPalier && (
        <section className="mt-4" aria-label="Prochain palier">
          <h2 className="text-[16px] font-bold">Palier {e.prochainPalier} : une cote d’environ {fc(e.coteParPalier)}</h2>
          <p className="text-[12px] text-ink-muted">Mise : <Montant texte={fcfa(e.capital)} />. Options des prochaines 48 h dont la cote est proche, la plus probable d’abord.</p>
          {options.length ? (
            <ul className="mt-2 space-y-2">
              {options.map((o) => (
                <li key={`${o.matchId}|${o.market}|${o.param}|${o.sel}`} className="tile flex items-center gap-3 p-3">
                  <Link href={`/matchs/${o.matchId}`} className="min-w-0 flex-1">
                    <span className="block text-[11px] text-ink-muted">{jourCourt(o.kickoff)} {heure(o.kickoff)} · {o.home} – {o.away}</span>
                    <span className="block text-[14px] font-semibold">{o.label}</span>
                    <span className="block text-[11.5px] text-ink-soft">{pct(o.p)} · cote {fc(o.cote!)}</span>
                  </Link>
                  <AddToSlip size="sm" leg={legFrom({ matchId: o.matchId, home: o.home, away: o.away, kickoff: o.kickoff, comp: o.comp, market: o.market, param: o.param, sel: o.sel, p: o.p, cote: o.cote, label: o.label })} />
                </li>
              ))}
            </ul>
          ) : <p className="tile mt-2 p-3 text-[12.5px] text-ink-soft">Aucune option des prochaines 48 h n’a une cote proche de {fc(e.coteParPalier)}. Tu peux combiner deux sélections plus probables dans le coupon, ou attendre les prochains matchs analysés.</p>}
        </section>
      )}

      {!fini && !e.enCours && (
        <section className="tile mt-4 p-3.5" aria-label="Rattacher un pari">
          <h2 className="text-[15px] font-bold">Rattacher le pari du palier {e.prochainPalier}</h2>
          <p className="text-[12px] text-ink-muted">Place ton pari (coupon, saisie ou import), puis choisis-le ici.</p>
          {(libres ?? []).length ? (
            <ul className="mt-2 divide-y divide-line">
              {(libres ?? []).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="min-w-0">{jourCourt(b.placed_at)} {heure(b.placed_at)} · <Montant texte={fcfa(Number(b.mise))} />{b.cote_totale ? ` · cote ${fc(Number(b.cote_totale))}` : ""}{b.virtuel ? " · test" : ""}</span>
                  <Rattacher montanteId={id} betId={b.id} />
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12.5px] text-ink-soft">Aucun pari placé depuis la création de la montante. <Link href="/paris/ajouter" className="font-semibold text-brand">Ajouter un pari</Link></p>}
        </section>
      )}

      <div className="mt-5 space-y-2">
        <ModifierSupprimer edition={{ id, nom: m.nom, mise: Number(m.mise_depart), objectif: Number(m.objectif), paliers: m.paliers_prevus, niveau: m.niveau, joues: (paliers ?? []).filter((b) => b.statut !== "annule").length }} />
        {!fini && <Arreter id={id} />}
        {m.statut === "arretee" && <Reprendre id={id} />}
      </div>
    </>
  );
}
