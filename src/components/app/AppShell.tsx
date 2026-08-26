import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, FolderKanban, Building2, BookOpen, Users, BarChart3, Settings, Menu, Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// `ready: false` marks a destination that does not exist yet. Those render as
// disabled items rather than links, so no navigation attempt can fail silently.
type NavKey = "commandCenter" | "projects" | "clients" | "programs" | "resources" | "analytics" | "admin";
type NavItem = { key: NavKey; icon: typeof LayoutDashboard; ready: boolean; current: boolean };

const navItems: NavItem[] = [
  { key: "commandCenter", icon: LayoutDashboard, ready: true, current: true },
  { key: "projects", icon: FolderKanban, ready: false, current: false },
  { key: "clients", icon: Building2, ready: false, current: false },
  { key: "programs", icon: BookOpen, ready: false, current: false },
  { key: "resources", icon: Users, ready: false, current: false },
  { key: "analytics", icon: BarChart3, ready: false, current: false },
  { key: "admin", icon: Settings, ready: false, current: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);

  // The mobile panel is a disclosure, not a dialog, but Escape should still close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav aria-label={t.app} className="flex flex-col gap-0.5 p-2">
      {navItems.map(({ key, icon: Icon, ready, current }) => {
        const base = "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium";
        if (current) {
          return (
            <span key={key} aria-current="page" className={cn(base, "border-s-2 border-hni-magenta rounded-s-none bg-surface-2 text-hni-magenta")}>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{t.nav[key]}</span>
            </span>
          );
        }
        if (!ready) {
          return (
            <span key={key} aria-disabled="true" className={cn(base, "cursor-default text-hni-grey-mid")}>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{t.nav[key]}</span>
              <span className="text-[11px] font-normal">{t.nav.soon}</span>
            </span>
          );
        }
        return (
          <a key={key} href="#" className={cn(base, "text-hni-grey-dark hover:bg-surface-2")}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{t.nav[key]}</span>
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      {/* Sidebar: persistent on desktop, disclosure panel on mobile */}
      <aside className="hidden md:flex md:flex-col border-e border-line-1 bg-surface-0">
        {/* Brand rule: clear space around the logo of at least 1x its height (logo is 20px, padding 20px). */}
        <div className="flex h-14 items-center px-5">
          <img src="/brand/logo-primary.svg" alt={t.app} className="h-5 w-auto" />
        </div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-line-1 bg-surface-0 px-3 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 md:hidden"
            aria-label={t.nav.menu}
            aria-expanded={open}
            aria-controls="app-nav-panel"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <img src="/brand/logo-primary.svg" alt={t.app} className="md:hidden ms-2 h-5 w-auto" />
          <div className="ms-auto">
            <Button variant="outline" size="sm" className="h-10 md:h-8" onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label={t.lang.label}>
              <Languages className="size-4" aria-hidden />
              <span>{t.lang.switch}</span>
            </Button>
          </div>
        </header>

        <div id="app-nav-panel" hidden={!open} className="md:hidden border-b border-line-1 bg-surface-0">
          {nav}
        </div>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
