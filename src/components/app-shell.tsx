import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Home, ClipboardList, Calendar, Shield, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const { location } = useRouterState();
  const isAgente = roles.includes("agente");
  const isGT = roles.includes("gt");
  const isGz = roles.includes("gz");
  const isAdmin = roles.includes("admin");

  const nav: { to: string; label: string; icon: typeof Home; show: boolean }[] = [
    { to: "/app", label: "Inicio", icon: Home, show: true },
    { to: "/app/turnos", label: "Turnos", icon: Calendar, show: isAgente },
    { to: "/app/mis-postulaciones", label: "Mis postul.", icon: ClipboardList, show: isAgente },
    { to: "/app/gt", label: "Mis turnos", icon: Briefcase, show: isGT || isGz },
    { to: "/app/admin", label: "Admin", icon: Shield, show: isAdmin },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/app" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">C</div>
            <span className="font-semibold">CoverTurnos</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline text-muted-foreground">
              {profile?.nombre_completo ?? "Mi cuenta"}
            </span>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch">
          {nav.map((n) => {
            const active = location.pathname === n.to || (n.to !== "/app" && location.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
