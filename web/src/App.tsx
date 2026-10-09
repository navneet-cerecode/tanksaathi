import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "@/components/AppShell";
import { LoadingBlock } from "@/components/bits";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { currentSession, signOut, type Session } from "@/lib/auth";
import { usePoll } from "@/lib/usePoll";
import { IncidentDetail, IncidentList } from "@/pages/Incidents";
import { Login } from "@/pages/Login";
import { Overview } from "@/pages/Overview";
import { ResidentStatus } from "@/pages/ResidentStatus";
import { Simulator } from "@/pages/Simulator";
import { TankDetail } from "@/pages/TankDetail";

const TANK_ID = "roof-1";

function CaretakerApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const b = session.buildingId;
  const tank = usePoll(() => api.tank(b, TANK_ID), 15_000, `tank-${b}`);
  const incidents = usePoll(() => api.incidents(b), 15_000, `incidents-${b}`);
  const refreshAll = useCallback(() => {
    void tank.refresh();
    void incidents.refresh();
  }, [tank.refresh, incidents.refresh]);
  const list = incidents.data?.incidents ?? null;
  const openCount = list?.filter((i) => i.status !== "resolved").length ?? 0;
  const onSimulator = useLocation().pathname.startsWith("/simulator");

  return (
    <AppShell session={session} simulated={onSimulator || (tank.data?.simulated ?? false)} openAlerts={openCount} onSignOut={onSignOut}>
      <Routes>
        <Route path="/overview" element={<Overview view={tank.data} incidents={list ?? []} error={tank.error} onRetry={refreshAll} onChanged={refreshAll} />} />
        <Route path="/tank" element={<TankDetail view={tank.data} error={tank.error} onRetry={tank.refresh} />} />
        <Route path="/incidents" element={<IncidentList incidents={list} error={incidents.error} onRetry={incidents.refresh} />} />
        <Route path="/incidents/:buildingId/:incidentId" element={<IncidentDetail onChanged={refreshAll} />} />
        {session.roles.includes("demo-operator") && <Route path="/simulator" element={<Simulator buildingId={b} onChanged={refreshAll} />} />}
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AppShell>
  );
}

function ResidentApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const status = usePoll(() => api.status(session.buildingId), 30_000, `status-${session.buildingId}`);
  return (
    <AppShell session={session} simulated={status.data?.simulated ?? false} onSignOut={onSignOut}>
      <Routes>
        <Route path="/status" element={<ResidentStatus view={status.data} error={status.error} onRetry={status.refresh} />} />
        <Route path="*" element={<Navigate to="/status" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const load = useCallback(() => void currentSession().then(setSession), []);
  useEffect(load, [load]);

  const out = async () => {
    await signOut();
    setSession(null);
  };

  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      {session === undefined ? (
        <div className="p-6">
          <LoadingBlock />
        </div>
      ) : session === null ? (
        <Login onSignedIn={load} />
      ) : session.roles.includes("caretaker") ? (
        <CaretakerApp session={session} onSignOut={out} />
      ) : session.roles.includes("resident") ? (
        <ResidentApp session={session} onSignOut={out} />
      ) : (
        <p className="p-6">Your account doesn't have a role in any building yet. Ask your building admin.</p>
      )}
    </BrowserRouter>
  );
}
