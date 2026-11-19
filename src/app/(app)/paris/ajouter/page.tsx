import Link from "next/link";
import { ParisNav } from "@/components/coach-nav";
import { PageHeader } from "@/components/page-header";
import { APP_NAME } from "@/lib/app-name";

/**
 * Mes paris › Ajouter (19/11) : les quatre façons de faire entrer un pari ou un prono dans l'application.
 * Les écrans de saisie existent déjà (import, nouveau, test) ; cette page les rassemble et dit à quoi sert chacun.
 */
const CHOIX = [
  { href: "/import", titre: "Charger un ticket", texte: "Une capture, une vidéo d’écran ou le texte copié depuis ton bookmaker. Il est lu, rattaché aux matchs et réglé seul.", icone: <><path d="M4 8V6a2 2 0 0 1 2-2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1-2 2h-2" /><path d="M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 10h8M8 14h5" /></>, fort: true },
  { href: "/nouveau", titre: "Saisir un pari", texte: "Simple ou combiné, à la main, sur un match suivi ou non. Il entre dans ta bankroll.", icone: <><path d="M12 5v14M5 12h14" /></> },
  { href: "/nouveau?test=1", titre: "Simuler un pari", texte: "Suivi et réglé comme un vrai pari, sans toucher à ta bankroll. Pour tester une idée ou une source.", icone: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" /></> },
  { href: "/import?pronos=1", titre: "Charger les pronos de ma communauté", texte: "La capture d’un tipster, d’un canal Telegram, d’un groupe WhatsApp ou d’une page Facebook : ses pronos sont notés sur leurs vrais résultats.", icone: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2a4.6 4.6 0 0 1 5 4.6" /></> },
];

export default function AjouterPage() {
  return (
    <>
      <ParisNav current="ajouter" />
      <PageHeader title="Ajouter" subtitle={`Tout ce que tu charges, ${APP_NAME} le règle et le compte dans tes statistiques.`} />
      <ul className="space-y-2.5">
        {CHOIX.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className={`tile flex items-center gap-3 p-3.5 active:bg-surface-2 ${c.fort ? "border-brand/50" : ""}`}>
              <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${c.fort ? "bg-brand text-on-fill" : "bg-brand-soft text-brand"}`}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{c.icone}</svg>
              </span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{c.titre}</span><span className="block text-[12px] leading-snug text-ink-muted">{c.texte}</span></span>
              <span aria-hidden className="text-brand">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">Tu suis un tipster qui n’est pas encore dans l’application ? <Link href="/sources/nouvelle" className="font-semibold text-brand">Ajoute la source</Link>, puis charge ses captures.</p>
    </>
  );
}
