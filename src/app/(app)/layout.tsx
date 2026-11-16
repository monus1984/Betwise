import { SlipBar } from "@/components/slip";
import { SwRegister } from "@/components/sw-register";
import { TabBar } from "@/components/tab-bar";
import { AddFab } from "@/components/add-fab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-xl px-4 pb-44 pt-[max(1.25rem,env(safe-area-inset-top))]">{children}</div>
      <AddFab />
      <SlipBar />
      <TabBar />
      <SwRegister />
    </>
  );
}
