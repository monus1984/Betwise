"use client";

/**
 * Masquage des montants (accueil, carte Coach) : un bouton œil cache tous les montants de la page, utile en public.
 * Le choix est gardé sur le téléphone ; rien n'est envoyé au serveur.
 */
import { useSyncExternalStore } from "react";

const CLE = "betwise.montants-masques";
const abonnes = new Set<() => void>();
const lire = () => { try { return localStorage.getItem(CLE) === "1"; } catch { return false; } };
const ecrire = (v: boolean) => { try { localStorage.setItem(CLE, v ? "1" : "0"); } catch { /* stockage indisponible : le choix vaut pour la page */ } abonnes.forEach((f) => f()); };
const abonner = (f: () => void) => { abonnes.add(f); return () => abonnes.delete(f); };

export function useMasque() {
  return useSyncExternalStore(abonner, lire, () => false);
}

/** Un montant déjà mis en forme (« 42 350 F ») ; remplacé par des points quand les montants sont masqués. */
export function Montant({ texte, className }: { texte: string; className?: string }) {
  const masque = useMasque();
  return <span className={className}>{masque ? "•••• F" : texte}</span>;
}

export function BoutonMasque() {
  const masque = useMasque();
  return (
    <button type="button" onClick={() => ecrire(!masque)} aria-pressed={masque} aria-label={masque ? "Afficher les montants" : "Masquer les montants"}
      className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-surface-2">
      {masque
        ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3 3.5M6.3 7.6C4.2 9.2 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1" /></svg>
        : <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" /><circle cx="12" cy="12" r="2.6" /></svg>}
    </button>
  );
}
