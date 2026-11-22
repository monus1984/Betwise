import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** Petits composants partagés. Pas de bibliothèque UI : on garde la main sur le poids et le rendu mobile. */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-lg border border-slate-300 bg-surface px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 " +
        (props.className ?? "")
      }
    />
  );
}

export function Button({ variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base = "inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-semibold transition disabled:opacity-50";
  const styles = {
    primary: "bg-brand text-on-fill active:brightness-90",
    ghost: "bg-slate-100 text-slate-900 active:bg-slate-200",
    danger: "bg-loss text-on-fill active:bg-loss",
  }[variant];
  return <button {...props} className={`${base} ${styles} ${props.className ?? ""}`} />;
}

export function Notice({ kind = "error", children }: { kind?: "error" | "info"; children: ReactNode }) {
  const cls = kind === "error" ? "border-loss/30 bg-loss-soft text-loss-ink" : "border-info/30 bg-info-soft text-info-ink";
  return <p className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</p>;
}

export function Chip({ active, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={
        "shrink-0 rounded-full border px-3 py-1.5 text-sm transition " +
        (active ? "border-inverse bg-inverse text-on-inverse" : "border-slate-300 bg-surface text-slate-700 active:bg-slate-100")
      }
    >
      {children}
    </button>
  );
}

/** Carte : le conteneur de base de tous les écrans. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</section>;
}

export type Etat = "gagne" | "perdu" | "rembourse" | "en_cours" | "a_confirmer" | "test" | "estimation";
const ETAT: Record<Etat, [string, string]> = {
  gagne: ["Gagné", "bg-gain-soft text-gain-ink"],
  perdu: ["Perdu", "bg-loss-soft text-loss-ink"],
  rembourse: ["Remboursé", "bg-surface-2 text-ink-soft"],
  en_cours: ["En cours", "bg-info-soft text-info-ink"],
  a_confirmer: ["À confirmer", "bg-draw-soft text-draw-ink"],
  test: ["Test", "bg-surface-2 text-ink-soft"],
  estimation: ["Estimation", "bg-draw-soft text-draw-ink"],
};
/** Pastille d'état : toujours un mot, jamais la couleur seule. */
export function Badge({ etat, children }: { etat: Etat; children?: ReactNode }) {
  const [mot, cls] = ETAT[etat];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children ?? mot}</span>;
}

/** État vide ou donnée indisponible : dit ce qui manque et, si possible, quoi faire. */
export function Empty({ titre, children, action }: { titre: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-semibold text-ink">{titre}</p>
      {children && <p className="mx-auto mt-1 max-w-[36ch] text-[13px] leading-relaxed text-ink-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export const fcfa = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " F";

/** Niveaux enregistrés en base (prudent, moyen, risque) affichés avec les mots des profils du 21/11. */
export const RISK_LABEL: Record<"prudent" | "moyen" | "risque", string> = { prudent: "Prudent", moyen: "Équilibré", risque: "Audacieux" };
export const RISK_CLASS: Record<"prudent" | "moyen" | "risque", string> = {
  prudent: "bg-gain-soft text-gain-ink border-gain/30",
  moyen: "bg-draw-soft text-draw-ink border-draw/40",
  risque: "bg-loss-soft text-loss-ink border-loss/30",
};
/** Niveau d'une cote affichée, mêmes bornes que les profils (1,10 / 1,30 / 1,55) ; null sous 1,10. */
export function riskFromOdds(c: number): "prudent" | "moyen" | "risque" | null {
  return !(c >= 1.1) ? null : c < 1.3 ? "prudent" : c < 1.55 ? "moyen" : "risque";
}
