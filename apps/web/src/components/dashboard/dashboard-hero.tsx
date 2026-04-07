import { Logo } from "../logo";

export function DashboardHero() {
  return (
    <header className="flex items-center pt-2 pb-1">
      <Logo size={48} className="gap-4" textClassName="text-2xl tracking-[0.18em]" />
    </header>
  );
}
