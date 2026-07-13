import { BottomNav } from "@/components/app-shell/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-[520px] px-5 pb-28 pt-2">{children}</main>
      <BottomNav />
    </div>
  );
}
