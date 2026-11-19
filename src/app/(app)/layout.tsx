import { SlipBar } from "@/components/slip";
import { SwRegister } from "@/components/sw-register";
import { TabBar } from "@/components/tab-bar";
import { Suspense } from "react";
import { BetsterFab } from "@/components/betster-fab";
import { OfflineBanner } from "@/components/offline-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineBanner />
      <div className="mx-auto max-w-xl px-4 pb-44 pt-[max(1.25rem,env(safe-area-inset-top))]">{children}</div>
      <Suspense fallback={null}><BetsterFab /></Suspense>
      <SlipBar />
      <TabBar />
      <SwRegister />
    </>
  );
}
