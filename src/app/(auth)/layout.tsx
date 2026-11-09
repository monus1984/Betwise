export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">BETWISE</h1>
        <p className="mt-1 text-sm text-slate-600">Comprends, mesure et maîtrise tes décisions.</p>
      </div>
      {children}
    </main>
  );
}
