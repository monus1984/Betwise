import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-xl px-4 pb-28 pt-6">{children}</div>
      <TabBar />
    </>
  );
}
