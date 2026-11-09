import { PageHeader } from "@/components/page-header";

export default function CoachPage() {
  return (
    <>
      <PageHeader title="Coach" subtitle="Analyse tes tickets, tes sources et ta bankroll." />
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
        Le coach arrive en phase 2. Il ne répondra qu’avec des chiffres issus de tes données, jamais inventés.
      </div>
    </>
  );
}
