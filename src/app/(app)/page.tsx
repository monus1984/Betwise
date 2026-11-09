import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { fcfa } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { bankrollMove } from "@/lib/bets/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profil (créé au besoin : couvre un compte Kehiwa qui ouvre BETWISE pour la première fois)
  const { data: profile } = await supabase.rpc("ensure_profile");

  const { data: summary } = await supabase.from("my_bankroll_summary").select("*").maybeSingle();
  const solde = Number(summary?.solde ?? 0);
  const exposition = Number(summary?.exposition ?? 0);
  const resultat = Number(summary?.resultat_net ?? 0);
  const nbRegles = Number(summary?.nb_regles ?? 0);
  const nbGagnes = Number(summary?.nb_gagnes ?? 0);

  const { count: enCours } = await supabase.from("bets").select("id", { count: "exact", head: true }).eq("statut", "en_cours");

  return (
    <>
      <PageHeader
        title={`Salut ${profile?.pseudo ?? ""}`}
        subtitle="Voici où tu en es."
        action={<form action={signOut}><button className="text-xs text-slate-500 underline">Déconnexion</button></form>}
      />

      <section className="rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-slate-300">Solde</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{fcfa(solde)}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Stat label="En jeu" value={fcfa(exposition)} sub={`${enCours ?? 0} pari${(enCours ?? 0) > 1 ? "s" : ""}`} />
          <Stat label="Résultat net" value={(resultat >= 0 ? "+" : "") + fcfa(resultat)} tone={resultat >= 0 ? "good" : "bad"} />
          <Stat label="Réussite" value={nbRegles ? `${nbGagnes}/${nbRegles}` : "—"} sub={nbRegles ? `${Math.round((100 * nbGagnes) / nbRegles)} %` : "aucun réglé"} />
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Alimenter ou retirer</h2>
        <form action={bankrollMove} className="flex gap-2">
          <select name="type" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="depot">Dépôt</option>
            <option value="retrait">Retrait</option>
          </select>
          <input name="montant" inputMode="numeric" placeholder="Montant F CFA" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">OK</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Le solde part de 0 : enregistre ton capital de départ comme premier dépôt.</p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Link href="/nouveau" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium active:bg-slate-50">+ Nouveau pari</Link>
        <Link href="/paris" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium active:bg-slate-50">Mes paris en cours</Link>
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">Connecté : {user?.email}</p>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  const cls = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-white";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`font-semibold tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
