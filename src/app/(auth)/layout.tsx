import { Mark } from "@/components/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col">
      <div className="pitch rounded-b-[32px] px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
        <Mark className="h-12 w-12" />
        <h1 className="mt-4 font-display text-5xl font-bold leading-none">BETWISE</h1>
        <p className="mt-2 max-w-[26ch] text-sm text-white/75">Comprends, mesure et maîtrise tes décisions de pari.</p>
      </div>
      <div className="flex-1 px-5 py-7">{children}</div>
    </main>
  );
}
