import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CoachNav } from "@/components/coach-nav";
import { COMP_FLAG, shortName } from "@/components/match-ui";
import { CAT_LABEL, CAT_STYLE, categorieOf } from "@/lib/coach/categories";
import { buildCombos, coteEstimee, legsParam, singlesOf, type Option } from "@/lib/options/build";
import { loadOptions, type Periode } from "@/lib/options/load";
import { createClient } from "@/lib/supabase/server";
import { AddAllToSlip, AddToSlip } from "@/components/slip";
import { legFrom } from "@/lib/slip/leg";

export type SP = { per?: string; min?: string; max?: string; fam?: string; vue?: string; cible?: string; m?: string; n?: string };
const PRESETS = [
  { k: "sur", label: "Sûr", min: 83, max: 91 },
  { k: "aud", label: "Audacieux", min: 67, max: 83 },
  { k: "ris", label: "Risqué", min: 53, max: 67 },
  { k: "mix", label: "Sûr + Audacieux", min: 67, max: 91 },
];
const FAMS = [{ k: "", label: "Tout" }, { k: "resultat", label: "Résultat" }, { k: "buts", label: "Buts" }, { k: "mitemps", label: "Mi-temps" }, { k: "combo", label: "Combos même match" }];
const CIBLES = [1.5, 2, 3, 5, 10];
const C = (x: number) => x.toFixed(2).replace(".", ",");
const pct = (x: number) => `${Math.round(x * 100)} %`;
const time = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export async function OptionsView({ sp, db }: { sp: SP; db: Awaited<ReturnType<typeof createClient>> }) {
  const per: Periode = sp.per === "demain" || sp.per === "48h" ? sp.per : "auj";
  let min = clamp(Number(sp.min) || 67, 30, 97), max = clamp(Number(sp.max) || 91, 31, 99);
  if (min >= max) [min, max] = [Math.min(min, max), Math.max(min, max) + 1];
  const fam = FAMS.some((f) => f.k === sp.fam) ? sp.fam ?? "" : "";
  const vue = sp.vue === "combines" ? "combines" : "simples";
  const cible = clamp(Number(String(sp.cible ?? "").replace(",", ".")) || 2, 1.1, 50);

  const [{ options: all, nbMatchs, nbCouverts }, { data: modele }] = await Promise.all([
    loadOptions(db, per),
    db.from("sources").select("id").eq("type", "modele_betwise").limit(1).maybeSingle(),
  ]);
  const inRange = all.filter((o) => o.p >= min / 100 && o.p <= max / 100 && (!fam || o.famille === fam));
  const focus = sp.m ? inRange.filter((o) => o.matchId === sp.m).sort((a, b) => b.p - a.p) : null;
  const singles = focus ?? singlesOf(inRange, 2);
  const shown = Math.min(singles.length, sp.n === "all" ? 300 : 40);
  const combos = vue === "combines" ? buildCombos(inRange, cible, 3) : [];

  const q = (patch: Partial<Record<keyof SP, string | number | null>>) => {
    const base: Record<string, string> = { ...(sp.m && !("m" in patch) ? { m: sp.m } : {}), per, min: String(min), max: String(max), fam, vue, cible: String(cible) };
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") delete base[k]; else base[k] = String(v); }
    if (!base.fam) delete base.fam;
    return `/options?${new URLSearchParams(base).toString()}`;
  };
  const saisir = (legs: Option[], test: boolean) => `/nouveau?${new URLSearchParams({ legs: legsParam(legs), ...(test ? { test: "1" } : {}), ...(modele?.id ? { origin: modele.id } : {}) }).toString()}`;

  const chip = (active: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft"}`;
  const small = (active: boolean) => `shrink-0 rounded-full border px-2.5 py-1 text-xs ${active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft"}`;

  return (
    <>
      <PageHeader title="Options du jour" subtitle="Choisis ton taux de réussite : BETWISE te donne les paris qui y correspondent, en simple ou en combiné." />
      <CoachNav current="options" />

      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {([["auj", "Aujourd’hui"], ["demain", "Demain"], ["48h", "48 h"]] as const).map(([k, l]) => <Link key={k} href={q({ per: k, m: null })} scroll={false} className={small(per === k)}>{l}</Link>)}
      </div>

      {/* Réussite visée */}
      <section className="mb-3 rounded-xl border border-line bg-white p-3 shadow-card">
        <p className="mb-2 text-xs font-semibold text-ink-soft">Réussite visée par sélection : <span className="tabular-nums text-ink">{min} à {max} %</span> <span className="font-normal text-ink-muted">· cotes justes {C(100 / max)} à {C(100 / min)}</span></p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <Link key={p.k} href={q({ min: p.min, max: p.max, m: null })} scroll={false} className={chip(min === p.min && max === p.max)}>{p.label} <span className="opacity-70">{p.min}–{p.max} %</span></Link>)}
        </div>
        <form action="/options" className="flex items-end gap-2">
          <input type="hidden" name="per" value={per} /><input type="hidden" name="vue" value={vue} /><input type="hidden" name="cible" value={cible} />{fam && <input type="hidden" name="fam" value={fam} />}
          <label className="text-[11px] text-ink-muted">De<input name="min" type="number" min={30} max={97} defaultValue={min} className="mt-0.5 block w-16 rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums text-ink" /></label>
          <label className="text-[11px] text-ink-muted">à<input name="max" type="number" min={31} max={99} defaultValue={max} className="mt-0.5 block w-16 rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums text-ink" /></label>
          <span className="pb-2 text-sm text-ink-muted">%</span>
          <button className="ml-auto rounded-lg bg-ink px-3 py-2 text-xs font-medium text-white">Appliquer</button>
        </form>
      </section>

      {/* Simples / combinés */}
      <div className="mb-3 grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1 text-sm font-medium">
        <Link href={q({ vue: "simples" })} scroll={false} className={`rounded-lg py-2 text-center ${vue === "simples" ? "bg-white shadow-card" : "text-ink-muted"}`}>En simple</Link>
        <Link href={q({ vue: "combines", m: null })} scroll={false} className={`rounded-lg py-2 text-center ${vue === "combines" ? "bg-white shadow-card" : "text-ink-muted"}`}>En combiné</Link>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {FAMS.map((f) => <Link key={f.k} href={q({ fam: f.k })} scroll={false} className={small(fam === f.k)}>{f.label}</Link>)}
      </div>

      {nbMatchs === 0 && <Empty>Plus aucun match à venir sur cette période. Essaie « Demain » ou « 48 h ».</Empty>}
      {nbMatchs > 0 && nbCouverts === 0 && <Empty>Les {nbMatchs} matchs de la période n’ont pas encore de cote ni d’estimation du modèle. Les cotes arrivent dans la matinée.</Empty>}

      {vue === "simples" && nbCouverts > 0 && (
        singles.length === 0 ? <Empty>Aucune option entre {min} et {max} % sur cette période. Élargis la fourchette.</Empty> : (
          <>
            {focus && <p className="mb-2 text-xs text-ink-muted">Toutes les options de {focus[0] ? `${focus[0].home} – ${focus[0].away}` : "ce match"} dans ta fourchette · <Link href={q({ m: null })} className="text-brand">revenir à la liste</Link></p>}
            <ul className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
              {singles.slice(0, shown).map((o, i) => <SingleRow key={`${o.matchId}-${o.market}-${o.param}-${o.sel}`} o={o} first={i === 0} tester={saisir([o], true)} more={focus ? null : q({ m: o.matchId })} />)}
            </ul>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-muted">
              {shown < singles.length && <><Link href={q({ n: "all" })} scroll={false} className="font-medium text-brand">Voir les {singles.length} options</Link> · </>}Deux options par match ici ; « ⋯ » ouvre toutes celles du match, « + » ajoute au coupon. « Cote » : cote de référence du marché. « Juste » : pas de cote de référence, c’est la cote sans marge ; ton bookmaker paiera un peu moins, vérifie avant de jouer.
            </p>
          </>
        )
      )}

      {vue === "combines" && nbCouverts > 0 && (
        <>
          <section className="mb-3 rounded-xl border border-line bg-white p-3 shadow-card">
            <p className="mb-2 text-xs font-semibold text-ink-soft">Cote recherchée</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {CIBLES.map((c) => <Link key={c} href={q({ cible: c })} scroll={false} className={chip(cible === c)}>{C(c)}</Link>)}
              <form action="/options" className="flex items-center gap-1.5">
                {Object.entries({ per, min, max, vue, ...(fam ? { fam } : {}) }).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
                <input name="cible" inputMode="decimal" defaultValue={CIBLES.includes(cible) ? "" : String(cible)} placeholder="autre" className="w-16 rounded-lg border border-line px-2 py-1.5 text-xs tabular-nums" />
                <button className="rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white">OK</button>
              </form>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              Un combiné coté {C(cible)} passe au mieux <b>{Math.round(100 / cible)} fois sur 100</b>, et ce plafond ne dépend pas des sélections : c’est la cote qui fixe le risque. Chaque match ajouté paie en plus la marge du bookmaker, ce qui fait baisser la réussite réelle{combos[0] ? <> (ici <b>{Math.round(combos[0].p * 100)} %</b>)</> : ""}. Les combinés ci-dessous prennent donc le moins de matchs possible, un pari par match.
            </p>
          </section>
          {combos.length === 0 ? <Empty>Aucune option dans ta fourchette pour composer un combiné.</Empty> : combos.map((c, k) => (
            <section key={k} className="mb-3 overflow-hidden rounded-xl border border-line bg-white shadow-card">
              <header className="flex items-baseline justify-between border-b border-line bg-surface-2 px-3 py-2">
                <span className="text-xs font-semibold">Combiné {k + 1} · {c.legs.length} sélection{c.legs.length > 1 ? "s" : ""}</span>
                <span className="text-xs tabular-nums text-ink-muted">cote ≈ <b className="text-ink">{C(c.cote)}</b></span>
              </header>
              <ul className="divide-y divide-line">
                {c.legs.map((o) => (
                  <li key={o.matchId} className="flex items-center gap-3 px-3 py-2">
                    <Link href={`/matchs/${o.matchId}`} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.label}</span>
                      <span className="block truncate text-[11px] text-ink-muted">{COMP_FLAG[o.comp] ?? "⚽"} {shortName(o.home)} – {shortName(o.away)} · {time(o.kickoff)}</span>
                    </Link>
                    <span className="shrink-0 text-right tabular-nums"><span className="block text-sm font-semibold">{pct(o.p)}</span><span className="block text-[11px] text-ink-muted">{o.cote ? C(o.cote) : `≈ ${C(coteEstimee(o))}`}</span></span>
                  </li>
                ))}
              </ul>
              <footer className="flex items-center gap-2 border-t border-line px-3 py-2.5">
                <span className="min-w-0 flex-1 text-xs">
                  <span className="font-semibold">Passe {pct(c.p)} du temps</span>
                  <span className="text-ink-muted"> · cote juste {C(c.coteJuste)}</span>
                  {!c.atteint && <span className="block text-draw">Pas assez de matchs pour atteindre {C(cible)} dans cette fourchette.</span>}
                </span>
                <AddAllToSlip legs={c.legs.map((o) => legFrom({ ...o, cote: o.cote }))} />
                <Link href={saisir(c.legs, true)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium">Tester</Link>
                <Link href={saisir(c.legs, false)} className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white">Parier</Link>
              </footer>
            </section>
          ))}
        </>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-ink-muted">
        Les pourcentages viennent des cotes de référence, marge retirée (le modèle prend le relais quand il n’y a pas de cote). Sur 4 004 matchs passés, l’écart entre le pourcentage annoncé et la réussite constatée reste de 1 à 3 points sur ces marchés. « Tester » enregistre le choix sans toucher à ta bankroll : tu vois ensuite si tes choix auraient payé.
      </p>
    </>
  );
}

function SingleRow({ o, first, tester, more }: { o: Option; first: boolean; tester: string; more: string | null }) {
  const cat = categorieOf(o.p);
  return (
    <li className={`flex items-center gap-2.5 px-3 py-2.5 ${first ? "" : "border-t border-line"}`}>
      <Link href={`/matchs/${o.matchId}`} className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{o.label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-ink-muted">{COMP_FLAG[o.comp] ?? "⚽"} {shortName(o.home)} – {shortName(o.away)} · {time(o.kickoff)}{o.source === "modele" ? " · modèle" : ""}{o.famille === "mitemps" ? " · % indicatif" : ""}</span>
      </Link>
      <span className="w-[68px] shrink-0 text-right tabular-nums">
        <span className="block text-sm font-bold">{pct(o.p)}</span>
        <span className="block text-[11px] text-ink-muted">{o.cote ? `cote ${C(o.cote)}` : `juste ${C(1 / o.p)}`}</span>
        {cat && <span className={`mt-0.5 inline-block rounded-full border px-1.5 text-[10px] font-medium ${CAT_STYLE[cat]}`}>{CAT_LABEL[cat]}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-center gap-1">
        <AddToSlip size="sm" leg={legFrom({ ...o, label: o.label })} />
        <Link href={tester} className="rounded-md border border-line px-1.5 py-0.5 text-center text-[10px] font-medium">Tester</Link>
      </span>
      {more && <Link href={more} scroll={false} aria-label="Toutes les options de ce match" className="-mr-1 shrink-0 px-1 text-lg leading-none text-ink-muted">⋯</Link>}
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-muted">{children}</div>;
}
