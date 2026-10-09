import { Bell, ChartLine, Droplet, FlaskConical, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import type { Session } from "@/lib/auth";
import { useOnline } from "@/lib/usePoll";
import { cn } from "@/lib/utils";

export function SimulatorRibbon() {
  return (
    <div className="sim-hatch px-4 py-1.5 text-caption font-medium tracking-[0.04em]" role="note">
      SENSOR SIMULATOR — NOT A REAL TANK
    </div>
  );
}

function Tab({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-caption",
          isActive ? "font-semibold text-ink" : "text-ink-2 hover:text-ink",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export function AppShell({
  session,
  simulated,
  openAlerts = 0,
  onSignOut,
  children,
}: {
  session: Session;
  simulated: boolean;
  openAlerts?: number;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const online = useOnline();
  const caretaker = session.roles.includes("caretaker");
  const operator = session.roles.includes("demo-operator");
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1200px] flex-col">
      {simulated && <SimulatorRibbon />}
      {!online && (
        <div role="status" className="bg-amber-fill px-4 py-2 text-label">
          You're offline. Showing what we last saw; actions will wait until you reconnect.
        </div>
      )}
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 md:px-8">
        <div className="flex items-center gap-2">
          <Droplet className="size-5 text-water" aria-hidden />
          <span className="font-semibold">TankSaathi</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-caption text-ink-2 sm:inline">{session.name}</span>
          <button type="button" onClick={onSignOut} className="flex min-h-11 items-center gap-1.5 rounded-sm px-2 text-label text-ink-2 hover:bg-sim hover:text-ink">
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-6 pt-4 md:px-8">{children}</main>

      {caretaker && (
        <nav aria-label="Sections" className="sticky bottom-0 flex border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:static md:order-first md:border-b md:border-t-0">
          <Tab to="/overview" icon={<Droplet className="size-5" aria-hidden />} label="Overview" />
          <Tab to="/tank" icon={<ChartLine className="size-5" aria-hidden />} label="Tank" />
          <Tab to="/incidents" icon={<Bell className="size-5" aria-hidden />} label={openAlerts ? `Alerts · ${openAlerts}` : "Alerts"} />
          {operator && <Tab to="/simulator" icon={<FlaskConical className="size-5" aria-hidden />} label="Simulator" />}
        </nav>
      )}
      <footer className="border-t border-rule px-4 py-3 text-caption text-ink-2 md:px-8">
        Team NicobarAndaman · Environmental Hacks 2026
      </footer>
    </div>
  );
}
