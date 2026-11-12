import { OddButton } from "@/components/slip";
import { shortName } from "@/components/match-ui";
import { MG_RANGES, pickLabel, picksOf, type Signal } from "@/lib/probs/signals";
import { legFrom } from "@/lib/slip/leg";

type M = { id: string; kickoff_at: string; home: string; away: string; comp: string; ouvert: boolean };
const L = (x: number) => String(x).replace(".", ",");

/** Tous les marchés d'un match, façon bookmaker : chaque cote s'ajoute au coupon d'un appui. */
export function MatchMarkets({ m, sg }: { m: M; sg: Signal }) {
  const picks = picksOf(sg, "all");
  const h = shortName(m.home), a = shortName(m.away);
  const get = (market: string, param: number | null, sel: string) => picks.find((p) => p.market === market && (p.param ?? null) === param && p.sel === sel) ?? null;
  const cell = (market: string, param: number | null, sel: string, name: string, wide = false) => {
    const p = get(market, param, sel); if (!p) return null;
    const leg = legFrom({ matchId: m.id, home: m.home, away: m.away, kickoff: m.kickoff_at, comp: m.comp, market, param, sel, p: p.p, cote: p.cote });
    return <OddButton key={`${market}${param}${sel}`} leg={leg} name={name} disabled={!m.ouvert} wide={wide} />;
  };
  const row = (cols: 2 | 3, cells: (React.ReactNode | null)[]) => <div className={`grid gap-1.5 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{cells}</div>;

  return (
    <div className="space-y-3">
      <Block title="Résultat du match">{row(3, [cell("1X2", null, "1", h), cell("1X2", null, "N", "Nul"), cell("1X2", null, "2", a)])}</Block>
      <Block title="Double chance">{row(3, [cell("DC", null, "1N", `${h} ou nul`), cell("DC", null, "12", "Pas de nul"), cell("DC", null, "N2", `${a} ou nul`)])}</Block>
      <Block title="Remboursé si match nul">{row(2, [cell("DNB", null, "1", h), cell("DNB", null, "2", a)])}</Block>
      <Block title="Nombre de buts">
        <div className="space-y-1.5">{[0.5, 1.5, 2.5, 3.5, 4.5].map((l) => <div key={l}>{row(2, [cell("OU", l, "Plus", `Plus de ${L(l)}`), cell("OU", l, "Moins", `Moins de ${L(l)}`)])}</div>)}</div>
      </Block>
      <Block title="Les deux équipes marquent">{row(2, [cell("BTTS", null, "Oui", "Oui"), cell("BTTS", null, "Non", "Non")])}</Block>
      {(["TT1", "TT2"] as const).map((t) => (
        <Block key={t} title={`Buts de ${t === "TT1" ? h : a}`}>
          <div className="space-y-1.5">{[0.5, 1.5, 2.5].map((l) => <div key={l}>{row(2, [cell(t, l, "Plus", `Plus de ${L(l)}`), cell(t, l, "Moins", `Moins de ${L(l)}`)])}</div>)}</div>
        </Block>
      ))}
      <Block title="Handicap">
        <div className="space-y-1.5">
          {row(2, [cell("AH", -1.5, "1", `${h} −1,5`), cell("AH", 1.5, "2", `${a} +1,5`)])}
          {row(2, [cell("AH", 1.5, "1", `${h} +1,5`), cell("AH", -1.5, "2", `${a} −1,5`)])}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-muted">−1,5 : gagner par 2 buts ou plus. +1,5 : ne pas perdre par 2 buts ou plus.</p>
      </Block>
      <Block title="Mi-temps" note="probabilités indicatives">
        <Sub>Résultat à la mi-temps</Sub>
        {row(3, [cell("HT_1X2", null, "1", h), cell("HT_1X2", null, "N", "Nul"), cell("HT_1X2", null, "2", a)])}
        <Sub>Double chance à la mi-temps</Sub>
        {row(3, [cell("HT_DC", null, "1N", `${h} ou nul`), cell("HT_DC", null, "12", "Pas de nul"), cell("HT_DC", null, "N2", `${a} ou nul`)])}
        <Sub>Buts en 1re mi-temps</Sub>
        <div className="space-y-1.5">{[0.5, 1.5].map((l) => <div key={l}>{row(2, [cell("HT_OU", l, "Plus", `Plus de ${L(l)}`), cell("HT_OU", l, "Moins", `Moins de ${L(l)}`)])}</div>)}</div>
        <Sub>Les deux marquent en 1re mi-temps</Sub>
        {row(2, [cell("HT_BTTS", null, "Oui", "Oui"), cell("HT_BTTS", null, "Non", "Non")])}
        <Group title="2e mi-temps">
          {row(3, [cell("H2_1X2", null, "1", h), cell("H2_1X2", null, "N", "Nul"), cell("H2_1X2", null, "2", a)])}
          {[0.5, 1.5].map((l) => <div key={l}>{row(2, [cell("H2_OU", l, "Plus", `Plus de ${L(l)}`), cell("H2_OU", l, "Moins", `Moins de ${L(l)}`)])}</div>)}
        </Group>
        <Group title="Mi-temps / fin de match">{["1", "N", "2"].flatMap((x) => ["1", "N", "2"].map((y) => cell("HTFT", null, `${x}/${y}`, pickLabel("HTFT", null, `${x}/${y}`, h, a), true)))}</Group>
        <Group title="Mi-temps avec le plus de buts">{row(3, [cell("HMG", null, "1", "1re"), cell("HMG", null, "N", "Autant"), cell("HMG", null, "2", "2e")])}</Group>
      </Block>
      <Block title="Autres paris sur les buts">
        <Sub>Pair ou impair</Sub>
        {row(2, [cell("OE", null, "Pair", "Pair"), cell("OE", null, "Impair", "Impair")])}
        <Group title="Tranche de buts">{MG_RANGES.map((x) => cell("MG", null, x, pickLabel("MG", null, x, h, a), true))}</Group>
      </Block>
      <Block title="Autres paris sur le résultat">
        <Sub>Gagne sans encaisser</Sub>
        {row(2, [cell("WTN", null, "1", h), cell("WTN", null, "2", a)])}
        <Group title="Handicap européen (3 issues)">{[-2, -1, 1, 2].flatMap((l) => ["1", "N", "2"].map((x) => cell("EH", l, x, pickLabel("EH", l, x, h, a), true)))}</Group>
      </Block>
      <Block title="Combinés du match" note="deux conditions, une seule sélection">
        <Group title="Double chance et buts">{["1N", "N2", "12"].flatMap((x) => [1.5, 2.5, 3.5].flatMap((l) => ["Plus", "Moins"].map((b) => cell("DC_OU", l, `${x}|${b}`, pickLabel("DC_OU", l, `${x}|${b}`, h, a), true))))}</Group>
        <Group title="Résultat et buts">{["1", "2"].flatMap((x) => [1.5, 2.5, 3.5].flatMap((l) => ["Plus", "Moins"].map((b) => cell("1X2_OU", l, `${x}|${b}`, pickLabel("1X2_OU", l, `${x}|${b}`, h, a), true))))}</Group>
        <Group title="Résultat et les deux marquent">{[...["1N", "N2", "12"].flatMap((x) => ["Oui", "Non"].map((b) => cell("DC_BTTS", null, `${x}|${b}`, pickLabel("DC_BTTS", null, `${x}|${b}`, h, a), true))), ...["1", "N", "2"].flatMap((x) => ["Oui", "Non"].map((b) => cell("1X2_BTTS", null, `${x}|${b}`, pickLabel("1X2_BTTS", null, `${x}|${b}`, h, a), true)))]}</Group>
        <Group title="Buts et les deux marquent">{[1.5, 2.5, 3.5].flatMap((l) => ["Plus", "Moins"].flatMap((x) => ["Oui", "Non"].map((b) => cell("OU_BTTS", l, `${x}|${b}`, pickLabel("OU_BTTS", l, `${x}|${b}`, h, a), true))))}</Group>
      </Block>
      <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
        Cote sans « ≈ » : cote de référence des bookmakers européens. « ≈ » : cote estimée à partir des probabilités, avec 5 % de marge ; ton bookmaker peut payer un peu plus ou moins. Les marchés de mi-temps supposent que 45 % des buts tombent avant la pause : pourcentages indicatifs, pas encore vérifiés sur notre historique. Le pourcentage est la chance de gagner d’après les cotes de référence, marge retirée{sg.source === "modele" ? " (ici le modèle BETWISE, faute de cote)" : ""}.
      </p>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-3 shadow-card">
      <h3 className="mb-2 flex items-baseline justify-between text-xs font-semibold text-ink-soft">{title}{note && <span className="font-normal text-ink-muted">{note}</span>}</h3>
      {children}
    </section>
  );
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 mt-2.5 text-[11px] font-medium text-ink-muted first:mt-0">{children}</p>;
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-line py-2 first-of-type:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium">{title}<span className="text-ink-muted group-open:rotate-180">▾</span></summary>
      <div className="mt-2 space-y-1.5">{children}</div>
    </details>
  );
}
