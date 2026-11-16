import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, Empty, Notice, fcfa } from "@/components/ui";
import { LineChart } from "@/components/line-chart";
import { bankrollAlignBk, bankrollMoveBk } from "@/lib/bets/actions";
import { comptes as calculer, SANS_NOM, type Mouvement } from "@/lib/bankroll/comptes";
import { loadDashboard } from "@/lib/stats/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VUES = [["ensemble", "Vue d’ensemble"], ["comptes", "Comptes"], ["mouvements", "Mouvements"]] as const;
const signe = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${fcfa(Math.abs(x))}`;
const ton = (x: number) => (x > 0 ? "text-gain" : x < 0 ? "text-loss" : "");
const TYPE: Record<string, string> = { depot: "Dépôt", retrait: "Retrait", mise: "Mise", gain: "Gain", ajustement: "Ajustement" };
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/** Ma bankroll : où est l'argent (par compte), d'où vient le solde (dépôts, paris, recalages), et le journal complet. */
export default async function BankrollPage({ searchParams }: { searchParams: Promise<{ v?: string; b?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const vue = VUES.some(([k]) => k === sp.v) ? sp.v! : "ensemble";
  const supabase = await createClient();
  const [{ data: journal }, { data: enCours }, { data: k }, d] = await Promise.all([
    supabase.from("my_bankroll_journal").select("id, type, montant, bet_id, note, at, bookmaker").order("at", { ascending: false }).limit(3000),
    supabase.from("bets").select("mise, bookmaker").eq("statut", "en_cours").eq("virtuel", false).limit(500),
    supabase.from("bankrolls").select("verifie_at").eq("active", true).maybeSingle(),
    loadDashboard(supabase, null),
  ]);
  const lignes = (journal ?? []).filter((t) => t.type && t.montant !== null) as unknown as (Mouvement & { id: string; note: string | null; at: string })[];
  const { comptes, total } = calculer(lignes, (enCours ?? []).map((b) => ({ mise: Number(b.mise), bookmaker: b.bookmaker })));
  const complet = (journal?.length ?? 0) < 3000;
  const sept = d.courbe.filter((p) => Date.now() - Date.parse(p.at) <= 7 * 86400000).reduce((s, p) => s + p.net, 0);

  return (
    <>
      <PageHeader title="Ma bankroll" subtitle="Où est ton argent, et d’où vient ton solde." action={<Link href="/">Accueil</Link>} />
      <nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="Vues de la bankroll">
        {VUES.map(([key, mot]) => (
          <Link key={key} href={`/bankroll?v=${key}`} scroll={false} aria-current={vue === key ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${vue === key ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>{mot}</Link>
        ))}
      </nav>
      {sp.ok && <div className="mb-3"><Notice kind="info">{sp.ok === "recalage" ? "Compte recalé. L’écart est inscrit dans les mouvements." : "Mouvement enregistré."}</Notice></div>}
      {sp.err && <div className="mb-3"><Notice>{sp.err === "saisie" ? "Indique un montant et un bookmaker." : "Enregistrement impossible. Réessaie."}</Notice></div>}
      {!complet && <div className="mb-3"><Notice kind="info">Journal très long : seuls les 3 000 derniers mouvements sont comptés ici.</Notice></div>}

      {vue === "ensemble" && (
        <div className="space-y-3">
          <Card>
            <p className="text-xs text-ink-muted">Solde disponible, tous comptes</p>
            <p className="text-4xl font-bold leading-tight tabular-nums">{fcfa(total.solde)}</p>
            <p className="mt-1 text-[12px] text-ink-muted">{total.enJeu > 0 ? `Plus ${fcfa(total.enJeu)} en jeu sur ${enCours?.length ?? 0} pari${(enCours?.length ?? 0) > 1 ? "s" : ""}, déjà sortis du solde.` : "Aucun pari en cours."}</p>
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {comptes.map((c) => (
                <li key={c.nom} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium">{c.nom}</span>
                  <span className="text-right"><b className="tabular-nums">{fcfa(c.solde)}</b>{c.enJeu > 0 && <span className="block text-[11px] text-ink-muted">+ {fcfa(c.enJeu)} en jeu</span>}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">D’où vient ce solde</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Ligne mot="Dépôts" v={total.depots} />
              <Ligne mot="Retraits" v={-total.retraits} />
              <Ligne mot="Gains moins pertes" note={`${d.regles} pari${d.regles > 1 ? "s" : ""} réglé${d.regles > 1 ? "s" : ""}`} v={total.resultat} couleur />
              <Ligne mot="Mises en jeu" note="rendues ou perdues à la fin des matchs" v={-total.enJeu} />
              {total.recalages !== 0 && <Ligne mot="Recalages" note="écarts constatés avec le bookmaker, non expliqués" v={total.recalages} />}
              <div className="flex items-baseline justify-between border-t border-line pt-2 font-semibold"><dt>Solde</dt><dd className="tabular-nums">{fcfa(total.solde)}</dd></div>
            </dl>
            {total.recalages !== 0 && <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">Un recalage corrige le solde, pas le bilan : les paris qui manquent ne comptent ni dans tes gains et pertes, ni dans la note de tes sources.</p>}
          </Card>

          <Card>
            <div className="flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Gains moins pertes cumulés</h2><span className="text-[11px] text-ink-muted">hors dépôts et retraits</span></div>
            <LineChart unit="F" empty="La courbe apparaît à partir de deux paris réglés." points={d.courbe.map((p) => ({ at: p.at, y: p.cumul, delta: p.net, libelle: p.libelle }))} />
            {d.courbe.length >= 2 && <p className="text-[12px] text-ink-muted">Sur les 7 derniers jours : <b className={`tabular-nums ${ton(sept)}`}>{signe(sept)}</b>. Chaque point est un pari réglé.</p>}
          </Card>
          <p className="px-1 text-[11px] text-ink-muted">{k?.verifie_at ? `Dernière comparaison avec un bookmaker le ${new Date(k.verifie_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" })}.` : "Solde jamais comparé à celui d’un bookmaker."} <Link href="/bankroll?v=comptes" className="text-brand underline">Comparer un compte</Link></p>
        </div>
      )}

      {vue === "comptes" && (
        <div className="space-y-3">
          {comptes.length === 0 && <Empty titre="Aucun compte pour l’instant">Enregistre ton premier dépôt ci-dessous : le compte du bookmaker sera créé avec.</Empty>}
          {comptes.map((c) => (
            <Card key={c.nom}>
              <div className="flex items-baseline justify-between gap-3"><h2 className="text-base font-bold">{c.nom}</h2><p className="text-xl font-bold tabular-nums">{fcfa(c.solde)}</p></div>
              <p className="text-[12px] text-ink-muted">{c.enJeu > 0 ? `${fcfa(c.enJeu)} en jeu · ` : ""}gains moins pertes : <span className={ton(c.resultat)}>{signe(c.resultat)}</span></p>
              {c.nom !== SANS_NOM ? (
                <>
                  <form action={bankrollAlignBk} className="mt-3 flex gap-2">
                    <input type="hidden" name="bookmaker" value={c.nom} />
                    <label className="min-w-0 flex-1"><span className="mb-1 block text-xs font-medium text-ink-soft">Solde affiché chez {c.nom}</span>
                      <input name="solde" inputMode="numeric" placeholder="Solde réel en F CFA" required className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base" /></label>
                    <button className="self-end rounded-lg bg-inverse px-4 py-2 text-sm font-medium text-on-inverse">Comparer</button>
                  </form>
                  <form action={bankrollMoveBk} className="mt-2 flex gap-2">
                    <input type="hidden" name="bookmaker" value={c.nom} />
                    <select name="type" aria-label="Type de mouvement" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"><option value="depot">Dépôt</option><option value="retrait">Retrait</option></select>
                    <input name="montant" inputMode="numeric" placeholder="Montant F CFA" aria-label="Montant" required className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-base" />
                    <button className="rounded-lg border border-line px-4 py-2 text-sm font-medium">OK</button>
                  </form>
                </>
              ) : <p className="mt-2 text-[12px] text-ink-muted">Mouvements et paris sans bookmaker. Indique le bookmaker sur chaque pari concerné pour les ranger dans le bon compte.</p>}
            </Card>
          ))}
          <Card>
            <h2 className="text-sm font-semibold">Ajouter un compte</h2>
            <form action={bankrollMoveBk} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="type" value="depot" />
              <input name="bookmaker" placeholder="Bookmaker" aria-label="Bookmaker" maxLength={40} required className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-base" />
              <input name="montant" inputMode="numeric" placeholder="Premier dépôt" aria-label="Premier dépôt" required className="w-36 rounded-lg border border-line bg-surface px-3 py-2 text-base" />
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-fill">Créer</button>
            </form>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">Un transfert entre deux bookmakers se saisit en deux temps : un retrait sur le premier, un dépôt sur le second. « Comparer » inscrit l’écart au journal sans rien effacer.</p>
          </Card>
        </div>
      )}

      {vue === "mouvements" && (
        <>
          <nav className="mb-3 flex gap-2 overflow-x-auto" aria-label="Filtrer par compte">
            {[null, ...comptes.map((c) => c.nom)].map((n) => (
              <Link key={n ?? "tous"} href={`/bankroll?v=mouvements${n ? `&b=${encodeURIComponent(n)}` : ""}`} scroll={false}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${(sp.b ?? null) === n ? "border-inverse bg-inverse text-on-inverse" : "border-line bg-surface text-ink-soft"}`}>{n ?? "Tous"}</Link>
            ))}
          </nav>
          {(() => {
            const vus = lignes.filter((t) => !sp.b || ((t.bookmaker ?? "").trim() || SANS_NOM).toLowerCase() === sp.b.toLowerCase()).slice(0, 150);
            if (vus.length === 0) return <Empty titre="Aucun mouvement">Les dépôts, mises, gains et recalages apparaîtront ici.</Empty>;
            return (
              <Card className="!p-0">
                <ul className="divide-y divide-line">
                  {vus.map((t) => {
                    const mot = t.note && !["Mise", "Gain"].includes(t.note) ? t.note : TYPE[t.type];
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          {t.bet_id ? <Link href={`/paris/${t.bet_id}`} className="block truncate text-sm font-medium underline decoration-line underline-offset-2">{mot}</Link> : <span className="block truncate text-sm font-medium">{mot}</span>}
                          <span className="block text-[11px] text-ink-muted">{quand(t.at)} · {(t.bookmaker ?? "").trim() || SANS_NOM}</span>
                        </span>
                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${ton(Number(t.montant))}`}>{signe(Number(t.montant))}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })()}
          <p className="mt-2 px-1 text-[11px] text-ink-muted">150 mouvements les plus récents. Rien n’est jamais effacé : une correction s’ajoute au journal.</p>
        </>
      )}
    </>
  );
}

function Ligne({ mot, note, v, couleur }: { mot: string; note?: string; v: number; couleur?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0">{mot}{note && <span className="block text-[11px] text-ink-muted">{note}</span>}</dt>
      <dd className={`shrink-0 tabular-nums ${couleur ? ton(v) : ""}`}>{signe(v)}</dd>
    </div>
  );
}
