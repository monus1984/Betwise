import { APP_NAME } from "@/lib/app-name";
import { Mark } from "@/components/icons";
import { DemoVideo } from "@/components/demo-video";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col">
      <div className="pitch rounded-b-[32px] px-6 pb-10 pt-[calc(env(safe-area-inset-top)+3.5rem)]">
        <Mark className="h-12 w-12" />
        <h1 className="mt-4 text-4xl font-bold leading-none tracking-tight">{APP_NAME}</h1>
        <p className="mt-2 max-w-[26ch] text-sm text-white/75">Comprends, mesure et maîtrise tes décisions de pari.</p>
        <div className="mt-4"><DemoVideo /></div>
      </div>
      <div className="flex-1 px-5 py-7">{children}</div>
    </main>
  );
}
