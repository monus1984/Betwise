import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { NIVEAU, lire, niveau, rendement, reussite } from "@/lib/sources/proof";
import { MARCHE_FR } from "../source-ui";

export const dynamic = "force-dynamic";

const pc = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
const unit = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(0)} %`);

/** Deux sources côte à côte, sur tous leurs pronos réglés. Chaque chiffre est donné avec son volume. */
export default async function ComparerPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: sources }, { data: proofs }] = await Promise.all([
    supabase.from("sources").select("id, nom, type").neq("type", "perso").order("nom"),
    supabase.from("source_proof").select("*"),
  ]);
  const liste = sources ?? [];
  const a = liste.find((s) => s.id === sp.a) ?? null, b = liste.find((s) => s.id === sp.b && s.id !== a?.id) ?? null;
  const proof = (id: string | undefined) => lire((proofs ?? []).find((p) => p.source_id === id));
  const pa = proof(a?.id), pb = proof(b?.id);
  const { data: marches } = a && b ? await supabase.from("source_proof_by_market").select("*").in("source_id", [a.id, b.id]) : { data: [] };
  const codes = [...new Set((marches ?? []).map((m) => m.market_code as string))]
    .map((c) => ({ c, n: (marches ?? []).filter((m) => m.market_code === c).reduce((s, m) => s + Number(m.regles ?? 0), 0) })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n);
  const cell = (id: string, c: string) => { const m = (marches ?? []).find((x) => x.source_id === id && x.market_code === c); const r = Number(m?.regles ?? 0); return r ? `${Number(m?.gagnes ?? 0)} sur ${r}` : "—"; };

  return (
    <>
      <PageHeader title="Comparer" subtitle="Deux sources, côte à côte." action={<Link href="/sources?f=classement">Classement</Link>} />
      <form className="mb-4 grid grid-cols-2 gap-2">
        {(["a", "b"] as const).map((k) => (
          <label key={k} className="block"><span className="mb-1 block text-xs font-medium text-ink-soft">Source {k.toUpperCase()}</span>
            <select name={k} defaultValue={(k === "a" ? a?.id : b?.id) ?? ""} className="w-full rounded-lg border border-line bg-surface px-2 py-2.5 text-sm">
              <option value="">Choisir…</option>
              {liste.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
        ))}
        <button className="col-span-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-on-fill">Comparer</button>
      </form>

      {!a || !b ? <Empty titre="Choisis deux sources différentes">La comparaison porte sur tous leurs pronos réglés.</Empty> : (
        <div className="space-y-3">
          <Card className="!p-0">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[12px] text-ink-muted"><th className="px-4 py-2.5 font-medium"><span className="sr-only">Mesure</span></th><th className="px-2 py-2.5 text-right font-semibold text-ink">{a.nom}</th><th className="px-4 py-2.5 text-right font-semibold text-ink">{b.nom}</th></tr></thead>
              <tbody className="divide-y divide-line border-t border-line">
                <Row mot="Niveau" x={NIVEAU[niveau(pa)]} y={NIVEAU[niveau(pb)]} />
                <Row mot="Pronos réglés" x={String(pa.prouvesRegles)} y={String(pb.prouvesRegles)} />
                <Row mot="Justes" x={pa.prouvesRegles ? `${pa.prouvesGagnes} sur ${pa.prouvesRegles}` : "—"} y={pb.prouvesRegles ? `${pb.prouvesGagnes} sur ${pb.prouvesRegles}` : "—"} />
                <Row mot="Réussite" x={pc(reussite(pa))} y={pc(reussite(pb))} />
                <Row mot="Attendu à ces cotes" x={pc(pa.attendu)} y={pc(pb.attendu)} />
                <Row mot="Rendement par prono" x={unit(rendement(pa))} y={unit(rendement(pb))} tons={[rendement(pa), rendement(pb)]} />
                <Row mot="Chargés avant le match" x={String(pa.prouves - pa.apresCoup)} y={String(pb.prouves - pb.apresCoup)} />
              </tbody>
            </table>
          </Card>
          {codes.length > 0 && (
            <Card className="!p-0">
              <h2 className="px-4 pt-3 text-sm font-semibold">Par marché</h2>
              <table className="mt-1 w-full text-sm">
                <tbody className="divide-y divide-line">
                  {codes.map(({ c }) => <Row key={c} mot={MARCHE_FR[c] ?? c} x={cell(a.id, c)} y={cell(b.id, c)} />)}
                </tbody>
              </table>
            </Card>
          )}
          <p className="px-1 text-[11px] leading-relaxed text-ink-muted">Regarde le nombre de pronos à côté de chaque chiffre : « 4 sur 5 » pèse moins que « 20 sur 25 ». Le rendement est le gain moyen par prono à mise égale, sur les pronos dont la cote est connue.</p>
        </div>
      )}
    </>
  );
}

function Row({ mot, note, x, y, tons }: { mot: string; note?: string; x: string; y: string; tons?: (number | null)[] }) {
  const ton = (v: number | null | undefined) => (v === null || v === undefined ? "" : v > 0 ? "text-gain" : v < 0 ? "text-loss" : "");
  return (
    <tr>
      <th scope="row" className="px-4 py-2 text-left text-[13px] font-normal text-ink-soft">{mot}{note && <span className="block text-[11px] text-ink-muted">{note}</span>}</th>
      <td className={`px-2 py-2 text-right font-medium tabular-nums ${ton(tons?.[0])}`}>{x}</td>
      <td className={`px-4 py-2 text-right font-medium tabular-nums ${ton(tons?.[1])}`}>{y}</td>
    </tr>
  );
}
