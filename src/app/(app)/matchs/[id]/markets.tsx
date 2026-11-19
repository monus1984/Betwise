import { APP_NAME } from "@/lib/app-name";
import Link from "next/link";
import { OddButton } from "@/components/slip";
import { shortName } from "@/components/match-ui";
import { MG_RANGES, NB_EQUIPE, NB_EXACT, pickLabel, picksOf, type Signal } from "@/lib/probs/signals";
import { probOf } from "@/lib/probs/grid";
import { quandReleve } from "./cotes-bookmaker";
import { legFrom } from "@/lib/slip/leg";

type M = { id: string; kickoff_at: string; home: string; away: string; comp: string; ouvert: boolean };
const L = (x: number) => String(x).replace(".", ",");

/** Tous les marchés d'un match, façon bookmaker : chaque cote s'ajoute au coupon d'un appui. */
export function MatchMarkets({ m, sg }: { m: M; sg: Signal }) {
  const picks = picksOf(sg, "all");
  const h = shortName(m.home), a = shortName(m.away);
  const get = (market: string, param: number | null, sel: string) => picks.find((p) => p.market === market && (p.param ?? null) === param && p.sel === sel) ?? null;
  // Cotes réelles d'un bookmaker (1xBet), quand le fournisseur les a relevées pour ce match
  const releve = sg.bookAll.length ? sg.bookAll.reduce((x, y) => (x.releveAt > y.releveAt ? x : y)) : null;
  const book = releve?.bookmaker ?? null;
  const cell = (market: string, param: number | null, sel: string, name: string, wide = false) => {
    const p = get(market, param, sel); if (!p) return null;
    const leg = legFrom({ matchId: m.id, home: m.home, away: m.away, kickoff: m.kickoff_at, comp: m.comp, market, param, sel, p: p.p, cote: p.cote, book: p.book });
    // au milieu des cotes du bookmaker, une cote médiane est signalée ; une cote estimée porte déjà « ≈ »
    return <OddButton key={`${market}${param}${sel}`} leg={leg} name={name} disabled={!m.ouvert} wide={wide} note={book && !p.book && p.cote ? "méd." : undefined} />;
  };
  // Marchés que l'application ne chiffre pas (corners, cartons) ou peu (score exact) : la cote du bookmaker, telle quelle
  const bookCell = (market: string, param: number | null, sel: string, name: string, wide = false) => {
    const o = sg.bookOdd(market, param, sel); if (!o) return null;
    const leg = legFrom({ matchId: m.id, home: m.home, away: m.away, kickoff: m.kickoff_at, comp: m.comp, market, param, sel, p: probOf(sg.grid, market, param, sel), cote: null, book: o });
    return <OddButton key={`${market}${param}${sel}`} leg={leg} name={name} disabled={!m.ouvert} wide={wide} />;
  };
  /** Lignes plus / moins d'un marché chez le bookmaker : les plus équilibrées (les deux côtés jouables), dans l'ordre. */
  const lignesBook = (market: string, max: number) => [...new Set(sg.bookAll.filter((o) => o.market === market && o.param !== null).map((o) => o.param as number))]
    .map((l) => ({ l, plus: sg.bookOdd(market, l, "Plus"), moins: sg.bookOdd(market, l, "Moins") }))
    .filter((x) => x.plus && x.moins)
    .sort((x, y) => Math.abs(x.plus!.cote - x.moins!.cote) - Math.abs(y.plus!.cote - y.moins!.cote)).slice(0, max).sort((x, y) => x.l - y.l);
  const scoresBook = sg.bookAll.filter((o) => o.market === "CS").sort((x, y) => x.cote - y.cote).slice(0, 8);
  const corners = lignesBook("CORN", 4), cartons = lignesBook("CARD", 3);
  // Handicap sur les corners : les lignes les plus proches de l'équilibre (cote entre 1,5 et 2,6)
  const cornersAh = sg.bookAll.filter((o) => o.market === "CORN_AH" && o.cote >= 1.5 && o.cote <= 2.6).sort((x, y) => (x.param ?? 0) - (y.param ?? 0) || x.sel.localeCompare(y.sel)).slice(0, 8);
  const row = (cols: 2 | 3, cells: (React.ReactNode | null)[]) => <div className={`grid gap-1.5 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{cells}</div>;

  // Deux étages : les marchés pour lesquels on a une vraie cote de bookmaker, puis ceux dont la probabilité est
  // seulement déduite (du résultat et du nombre de buts, ou du modèle). Les seconds portent toujours « estimation ».
  const blocs: { m: string[]; n: React.ReactNode }[] = [
      { m: ["1X2"], n: (
      <Block key="Résultat du match" title="Résultat du match">{row(3, [cell("1X2", null, "1", h), cell("1X2", null, "N", "Nul"), cell("1X2", null, "2", a)])}</Block>
      ) },
      { m: ["DC"], n: (
      <Block key="Double chance" title="Double chance">{row(3, [cell("DC", null, "1N", `${h} ou nul`), cell("DC", null, "12", "Pas de nul"), cell("DC", null, "N2", `${a} ou nul`)])}</Block>
      ) },
      { m: ["DNB"], n: (
      <Block key="Remboursé si match nul" title="Remboursé si match nul">{row(2, [cell("DNB", null, "1", h), cell("DNB", null, "2", a)])}</Block>
      ) },
      { m: ["OU"], n: (
      <Block key="Nombre de buts" title="Nombre de buts">
        <div className="space-y-1.5">{[0.5, 1.5, 2.5, 3.5, 4.5].map((l) => <div key={l}>{row(2, [cell("OU", l, "Plus", `Plus de ${L(l)}`), cell("OU", l, "Moins", `Moins de ${L(l)}`)])}</div>)}</div>
      </Block>
      ) },
      { m: ["BTTS"], n: (
      <Block key="Les deux équipes marquent" title="Les deux équipes marquent">{row(2, [cell("BTTS", null, "Oui", "Oui"), cell("BTTS", null, "Non", "Non")])}</Block>
      ) },
      ...(["TT1", "TT2"] as const).map((t) => ({ m: [t as string], n: (
        <Block key={t} title={`Buts de ${t === "TT1" ? h : a}`}>
          <div className="space-y-1.5">{[0.5, 1.5, 2.5].map((l) => <div key={l}>{row(2, [cell(t, l, "Plus", `Plus de ${L(l)}`), cell(t, l, "Moins", `Moins de ${L(l)}`)])}</div>)}</div>
        </Block>
      ) })),
      { m: ["AH"], n: (
      <Block key="Handicap" title="Handicap">
        <div className="space-y-1.5">
          {row(2, [cell("AH", -1.5, "1", `${h} −1,5`), cell("AH", 1.5, "2", `${a} +1,5`)])}
          {row(2, [cell("AH", 1.5, "1", `${h} +1,5`), cell("AH", -1.5, "2", `${a} −1,5`)])}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-muted">−1,5 : gagner par 2 buts ou plus. +1,5 : ne pas perdre par 2 buts ou plus.</p>
      </Block>
      ) },
      { m: ["HT_1X2", "HT_DC", "HT_OU", "HT_BTTS", "H2_1X2", "H2_OU", "HTFT", "HMG", "HT_DNB", "H2_DNB", "H2_DC", "H2_BTTS", "HT_OE", "H2_OE", "WEH", "WBH", "SBH", "BH", "HT_TT1", "HT_TT2", "H2_TT1", "H2_TT2"], n: (
      <Block key="Mi-temps" title="Mi-temps">
        <Sub>Résultat à la mi-temps</Sub>
        {row(3, [cell("HT_1X2", null, "1", h), cell("HT_1X2", null, "N", "Nul"), cell("HT_1X2", null, "2", a)])}
        <Sub>Double chance à la mi-temps</Sub>
        {row(3, [cell("HT_DC", null, "1N", `${h} ou nul`), cell("HT_DC", null, "12", "Pas de nul"), cell("HT_DC", null, "N2", `${a} ou nul`)])}
        <Sub>Buts en 1re mi-temps</Sub>
        <div className="space-y-1.5">{[0.5, 1.5].map((l) => <div key={l}>{row(2, [cell("HT_OU", l, "Plus", `Plus de ${L(l)}`), cell("HT_OU", l, "Moins", `Moins de ${L(l)}`)])}</div>)}</div>
        <Sub>Les deux marquent en 1re mi-temps</Sub>
        {row(2, [cell("HT_BTTS", null, "Oui", "Oui"), cell("HT_BTTS", null, "Non", "Non")])}
        <Group title="1re mi-temps : remboursé si nul, pair ou impair, buts d’une équipe">
          {row(2, [cell("HT_DNB", null, "1", `${h} (remb. si nul)`), cell("HT_DNB", null, "2", `${a} (remb. si nul)`)])}
          {row(2, [cell("HT_OE", null, "Pair", "Buts : pair"), cell("HT_OE", null, "Impair", "Buts : impair")])}
          {(["HT_TT1", "HT_TT2"] as const).map((t) => <div key={t}>{row(2, [cell(t, 0.5, "Plus", `${t === "HT_TT1" ? h : a} marque`), cell(t, 0.5, "Moins", `${t === "HT_TT1" ? h : a} ne marque pas`)])}</div>)}
        </Group>
        <Group title="2e mi-temps">
          {row(3, [cell("H2_1X2", null, "1", h), cell("H2_1X2", null, "N", "Nul"), cell("H2_1X2", null, "2", a)])}
          {row(3, [cell("H2_DC", null, "1N", `${h} ou nul`), cell("H2_DC", null, "12", "Pas de nul"), cell("H2_DC", null, "N2", `${a} ou nul`)])}
          {row(2, [cell("H2_DNB", null, "1", `${h} (remb. si nul)`), cell("H2_DNB", null, "2", `${a} (remb. si nul)`)])}
          {[0.5, 1.5].map((l) => <div key={l}>{row(2, [cell("H2_OU", l, "Plus", `Plus de ${L(l)}`), cell("H2_OU", l, "Moins", `Moins de ${L(l)}`)])}</div>)}
          {row(2, [cell("H2_BTTS", null, "Oui", "Les deux marquent"), cell("H2_BTTS", null, "Non", "Pas les deux")])}
          {row(2, [cell("H2_OE", null, "Pair", "Buts : pair"), cell("H2_OE", null, "Impair", "Buts : impair")])}
          {(["H2_TT1", "H2_TT2"] as const).map((t) => <div key={t}>{row(2, [cell(t, 0.5, "Plus", `${t === "H2_TT1" ? h : a} marque`), cell(t, 0.5, "Moins", `${t === "H2_TT1" ? h : a} ne marque pas`)])}</div>)}
        </Group>
        <Group title="Sur les deux mi-temps">
          {row(2, [cell("WEH", null, "1", `${h} gagne au moins une mi-temps`), cell("WEH", null, "2", `${a} gagne au moins une mi-temps`)])}
          {row(2, [cell("WBH", null, "1", `${h} gagne les deux`), cell("WBH", null, "2", `${a} gagne les deux`)])}
          {row(2, [cell("SBH", null, "1", `${h} marque dans les deux`), cell("SBH", null, "2", `${a} marque dans les deux`)])}
          {row(2, [cell("BH", null, "Oui", "But dans les deux mi-temps"), cell("BH", null, "Non", "Une mi-temps sans but")])}
        </Group>
        <Group title="Mi-temps / fin de match">{["1", "N", "2"].flatMap((x) => ["1", "N", "2"].map((y) => cell("HTFT", null, `${x}/${y}`, pickLabel("HTFT", null, `${x}/${y}`, h, a), true)))}</Group>
        <Group title="Mi-temps avec le plus de buts">{row(3, [cell("HMG", null, "1", "1re"), cell("HMG", null, "N", "Autant"), cell("HMG", null, "2", "2e")])}</Group>
      </Block>
      ) },
      { m: ["OE", "MG", "OE1", "OE2", "MG1", "MG2", "FTS"], n: (
      <Block key="Autres paris sur les buts" title="Autres paris sur les buts">
        <Sub>Première équipe à marquer</Sub>
        {row(3, [cell("FTS", null, "1", h), cell("FTS", null, "Aucun", "Aucun but"), cell("FTS", null, "2", a)])}
        <Sub>Pair ou impair</Sub>
        {row(2, [cell("OE", null, "Pair", "Pair"), cell("OE", null, "Impair", "Impair")])}
        <Group title="Nombre exact de buts">{NB_EXACT.map((x) => cell("MG", null, x, pickLabel("MG", null, x, h, a), true))}</Group>
        <Group title="Tranche de buts">{MG_RANGES.map((x) => cell("MG", null, x, pickLabel("MG", null, x, h, a), true))}</Group>
        <Group title={`Buts de ${h} : nombre exact, pair ou impair`}>{[...NB_EQUIPE.map((x) => cell("MG1", null, x, pickLabel("MG1", null, x, h, a), true)), cell("OE1", null, "Pair", pickLabel("OE1", null, "Pair", h, a), true), cell("OE1", null, "Impair", pickLabel("OE1", null, "Impair", h, a), true)]}</Group>
        <Group title={`Buts de ${a} : nombre exact, pair ou impair`}>{[...NB_EQUIPE.map((x) => cell("MG2", null, x, pickLabel("MG2", null, x, h, a), true)), cell("OE2", null, "Pair", pickLabel("OE2", null, "Pair", h, a), true), cell("OE2", null, "Impair", pickLabel("OE2", null, "Impair", h, a), true)]}</Group>
      </Block>
      ) },
      { m: ["WTN", "EH"], n: (
      <Block key="Autres paris sur le résultat" title="Autres paris sur le résultat">
        <Sub>Gagne sans encaisser</Sub>
        {row(2, [cell("WTN", null, "1", h), cell("WTN", null, "2", a)])}
        <Group title="Handicap européen (3 issues)">{[-2, -1, 1, 2].flatMap((l) => ["1", "N", "2"].map((x) => cell("EH", l, x, pickLabel("EH", l, x, h, a), true)))}</Group>
      </Block>
      ) },
      { m: ["DC_OU", "1X2_OU", "DC_BTTS", "1X2_BTTS", "OU_BTTS"], n: (
      <Block key="Combinés du match" title="Combinés du match" note="deux conditions, une seule sélection">
        <Group title="Double chance et buts">{["1N", "N2", "12"].flatMap((x) => [1.5, 2.5, 3.5].flatMap((l) => ["Plus", "Moins"].map((b) => cell("DC_OU", l, `${x}|${b}`, pickLabel("DC_OU", l, `${x}|${b}`, h, a), true))))}</Group>
        <Group title="Résultat et buts">{["1", "2"].flatMap((x) => [1.5, 2.5, 3.5].flatMap((l) => ["Plus", "Moins"].map((b) => cell("1X2_OU", l, `${x}|${b}`, pickLabel("1X2_OU", l, `${x}|${b}`, h, a), true))))}</Group>
        <Group title="Résultat et les deux marquent">{[...["1N", "N2", "12"].flatMap((x) => ["Oui", "Non"].map((b) => cell("DC_BTTS", null, `${x}|${b}`, pickLabel("DC_BTTS", null, `${x}|${b}`, h, a), true))), ...["1", "N", "2"].flatMap((x) => ["Oui", "Non"].map((b) => cell("1X2_BTTS", null, `${x}|${b}`, pickLabel("1X2_BTTS", null, `${x}|${b}`, h, a), true)))]}</Group>
        <Group title="Buts et les deux marquent">{[1.5, 2.5, 3.5].flatMap((l) => ["Plus", "Moins"].flatMap((x) => ["Oui", "Non"].map((b) => cell("OU_BTTS", l, `${x}|${b}`, pickLabel("OU_BTTS", l, `${x}|${b}`, h, a), true))))}</Group>
      </Block>
      ) },
  ];
  const chezBook = (mk: string[]) => picks.some((p) => mk.includes(p.market) && p.book !== null);
  const reel = (mk: string[]) => picks.some((p) => mk.includes(p.market) && p.cote !== null);
  const cotes = blocs.filter((b) => chezBook(b.m)), suivis = blocs.filter((b) => !chezBook(b.m) && reel(b.m)), estimes = blocs.filter((b) => !chezBook(b.m) && !reel(b.m));
  const quand = releve ? quandReleve(releve.releveAt) : "";

  return (
    <div className="space-y-3">
      {cotes.length > 0 && <Etage titre={`Cotes ${book}`} texte={`Cotes ${book} relevées ${quand} : elles ont pu bouger, ton coupon fait foi. Le pourcentage est notre estimation de la chance de gagner. « méd. » ou « ≈ » : sélection absente du relevé.`} />}
      {cotes.map((b) => b.n)}
      {book && (corners.length > 0 || cartons.length > 0 || scoresBook.length > 0) && (
        <Block title="Corners, cartons, score exact" note={`cotes ${book}`}>
          {corners.length > 0 && <><Sub>Corners dans le match</Sub><div className="space-y-1.5">{corners.map((x) => <div key={x.l}>{row(2, [bookCell("CORN", x.l, "Plus", `Plus de ${L(x.l)}`), bookCell("CORN", x.l, "Moins", `Moins de ${L(x.l)}`)])}</div>)}</div></>}
          {cornersAh.length > 0 && <Group title="Corners : handicap, double chance, pair ou impair">
            {cornersAh.map((o) => bookCell("CORN_AH", o.param, o.sel, pickLabel("CORN_AH", o.param, o.sel, h, a), true))}
            {["1N", "12", "N2"].map((x) => bookCell("CORN_DC", null, x, pickLabel("CORN_DC", null, x, h, a), true))}
            {["Pair", "Impair"].map((x) => bookCell("CORN_OE", null, x, pickLabel("CORN_OE", null, x, h, a), true))}
          </Group>}
          {cartons.length > 0 && <><Sub>Cartons dans le match</Sub><div className="space-y-1.5">{cartons.map((x) => <div key={x.l}>{row(2, [bookCell("CARD", x.l, "Plus", `Plus de ${L(x.l)}`), bookCell("CARD", x.l, "Moins", `Moins de ${L(x.l)}`)])}</div>)}</div></>}
          {scoresBook.length > 0 && <Group title="Score exact : les huit plus probables">{scoresBook.map((o) => bookCell("CS", null, o.sel, `Score exact ${o.sel}`, true))}</Group>}
          <p className="mt-2 text-[11px] text-ink-muted">Corners et cartons : pas de pourcentage, {APP_NAME} ne les estime pas encore. Le pari est réglé avec les statistiques du match.</p>
        </Block>
      )}
      {suivis.length > 0 && <Etage titre="Cotes de référence" texte="Marchés pour lesquels on a la cote médiane des bookmakers européens. La probabilité affichée en découle, marge retirée." />}
      {suivis.map((b) => b.n)}
      {estimes.length > 0 && <Etage estime titre="Estimations" texte={suivis.length || cotes.length ? "Aucune cote de bookmaker sur ces marchés : la probabilité est déduite du résultat et du nombre de buts attendus. À comparer à la cote de ton bookmaker avant de t’y fier." : "Aucune cote de bookmaker sur ce match : toutes les probabilités viennent du modèle statistique. Elles sont moins fiables que des cotes de marché."} />}
      {estimes.map((b) => b.n)}
      {m.ouvert && (
        <Block title="Corners, cartons, tirs, joueurs" note="sans pourcentage">
          <div className="flex flex-wrap gap-1.5">
            {[["CORN", "Corners"], ["CORN_AH", "Handicap corners"], ["CARD", "Cartons"], ["PCARD", "Joueur averti"], ["RED", "Carton rouge"], ["SOT", "Tirs cadrés"], ["SHOT", "Tirs"], ["FOUL", "Fautes"], ["OFF", "Hors-jeu"],
              ["BUT", "Buteur"], ["BUT1", "Premier buteur"], ["BUTL", "Dernier buteur"], ["BUT2", "Doublé d’un joueur"], ["GB", "But avant la minute…"], ["PK", "Penalty"], ["OG", "But contre son camp"], ["QUALIF", "Qualification"], ["ET", "Prolongation"]].map(([code, label]) => (
              <Link key={code} href={`/nouveau?match=${m.id}&market=${code}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium">{label}</Link>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">{APP_NAME} enregistre et règle ces paris avec les statistiques du match, mais n’estime pas leurs chances : tu saisis la cote de ton bookmaker.</p>
        </Block>
      )}
      <p className="px-1 text-[11px] leading-relaxed text-ink-muted">
        {book ? `Cote sans signe : cote ${book} relevée. « méd. » : cote médiane des bookmakers européens. ` : "Cote sans « ≈ » : cote médiane des bookmakers européens. "}« ≈ » : cote estimée à partir des probabilités, avec 5 % de marge ; ton bookmaker peut payer un peu plus ou moins. Le pourcentage est la chance de gagner d’après les cotes de référence, marge retirée{sg.source === "modele" ? ` (ici le modèle ${APP_NAME}, faute de cote)` : ""}. Vérifié sur 4 004 matchs de championnat : ce que l’application annonce à 75 % arrive 75 à 76 fois sur 100, marchés de mi-temps compris (45 % des buts supposés avant la pause, 44 % mesurés).
      </p>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3 shadow-card">
      <h3 className="mb-2 flex items-baseline justify-between text-xs font-semibold text-ink-soft">{title}{note && <span className="font-normal text-ink-muted">{note}</span>}</h3>
      {children}
    </section>
  );
}
function Etage({ titre, texte, estime }: { titre: string; texte: string; estime?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${estime ? "border-draw/40 bg-draw-soft" : "border-brand/30 bg-brand-soft"}`}>
      <p className={`text-sm font-semibold ${estime ? "text-draw-ink" : "text-ink"}`}>{titre}</p>
      <p className={`mt-0.5 text-[12px] leading-snug ${estime ? "text-draw-ink" : "text-ink-soft"}`}>{texte}</p>
    </div>
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
