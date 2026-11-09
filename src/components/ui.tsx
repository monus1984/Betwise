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
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 " +
        (props.className ?? "")
      }
    />
  );
}

export function Button({ variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base = "inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-base font-medium transition disabled:opacity-50";
  const styles = {
    primary: "bg-slate-900 text-white active:bg-slate-700",
    ghost: "bg-slate-100 text-slate-900 active:bg-slate-200",
    danger: "bg-red-600 text-white active:bg-red-700",
  }[variant];
  return <button {...props} className={`${base} ${styles} ${props.className ?? ""}`} />;
}

export function Notice({ kind = "error", children }: { kind?: "error" | "info"; children: ReactNode }) {
  const cls = kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-sky-900";
  return <p className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</p>;
}

export function Chip({ active, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={
        "shrink-0 rounded-full border px-3 py-1.5 text-sm transition " +
        (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 active:bg-slate-100")
      }
    >
      {children}
    </button>
  );
}

export const fcfa = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " F";

export const RISK_LABEL: Record<"prudent" | "moyen" | "risque", string> = { prudent: "Prudent", moyen: "Moyen", risque: "Risqué" };
export const RISK_CLASS: Record<"prudent" | "moyen" | "risque", string> = {
  prudent: "bg-emerald-50 text-emerald-800 border-emerald-200",
  moyen: "bg-amber-50 text-amber-800 border-amber-200",
  risque: "bg-red-50 text-red-800 border-red-200",
};
export function riskFromOdds(c: number): "prudent" | "moyen" | "risque" {
  return c < 1.5 ? "prudent" : c <= 2.2 ? "moyen" : "risque";
}
