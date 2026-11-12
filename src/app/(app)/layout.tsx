import { SwRegister } from "@/components/sw-register";
import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-xl px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">{children}</div>
      <TabBar />
      <SwRegister />
    </>
  );
}
