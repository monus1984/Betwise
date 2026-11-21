import Link from "next/link";

/** « + » de la bannière : charger un coupon ou saisir un pari (page Ajouter, qui propose les quatre façons). */
export function BoutonAjout({ sombre }: { sombre?: boolean }) {
  return (
    <Link href="/paris/ajouter" aria-label="Charger un coupon ou saisir un pari"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-80 ${sombre ? "bg-surface text-ink" : "bg-brand text-on-fill"}`}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
    </Link>
  );
}
