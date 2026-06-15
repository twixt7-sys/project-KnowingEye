import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ChevronLeft,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { brand } from "../../../core/config/brand";
import { useAuth } from "../../../core/providers/auth-provider";
import { examinerNav } from "../../../core/config/examiner-nav";
import { examineeNav } from "../../../core/config/examinee-nav";
import { Logo } from "./logo";
import { SchoolBackground } from "./school-background";
import { ThemeToggle } from "../common/theme-toggle";
import { WorkspaceAlertsBell } from "../common/workspace-alerts-bell";
import { cn } from "../ui/utils";

type WorkspaceRole = "examiner" | "examinee";
type WorkspaceVariant = "default" | "focus";

type WorkspaceLayoutProps = {
  role: WorkspaceRole;
  variant?: WorkspaceVariant;
  children: React.ReactNode;
};

const roleMeta: Record<
  WorkspaceRole,
  { title: string; subtitle: string; accent: string; nav: typeof examinerNav }
> = {
  examiner: {
    title: "Examiner",
    subtitle: "Control center",
    accent: "from-primary/20 to-secondary/10",
    nav: examinerNav,
  },
  examinee: {
    title: "Examinee",
    subtitle: "Exam workspace",
    accent: "from-secondary/15 to-primary/10",
    nav: examineeNav,
  },
};

function isNavActive(pathname: string, path: string) {
  if (path === "/examiner" || path === "/examinee") {
    return pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function WorkspaceLayout({
  role,
  variant = "default",
  children,
}: WorkspaceLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const meta = roleMeta[role];
  const isFocus = variant === "focus";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const sidebar = (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <Logo className="h-8 w-8 shrink-0 text-sidebar-primary" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{brand.appName}</p>
            <p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {meta.nav.map((item) => {
          const active = isNavActive(location.pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}
              />
              {!collapsed && (
                <span className="truncate font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-sidebar-border bg-sidebar p-3">
        {!collapsed && user && (
          <div className="mb-3 rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <p className="truncate text-sm font-medium">{user.username}</p>
            <p className="truncate text-xs text-muted-foreground">{user.role}</p>
          </div>
        )}
        <div className={cn("flex gap-2", collapsed ? "flex-col items-center" : "")}>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "w-full" : "flex-1"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </div>
    </aside>
  );

  if (isFocus) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link
              to="/examinee"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to exams
            </Link>
            <div className="flex items-center gap-2">
              <Logo className="h-6 w-6 text-primary" />
              <span className="hidden text-sm font-medium sm:inline">{meta.title} session</span>
            </div>
            <div className="w-24" />
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-screen w-64 shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
        <SchoolBackground variant="workspace" />
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border lg:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {meta.title} workspace
              </p>
            </div>

            {user && (
              <div className="flex items-center gap-2">
                {role === "examiner" && <WorkspaceAlertsBell />}
                <div className="hidden items-center gap-2 rounded-full border border-border bg-form-field px-3 py-1.5 text-sm sm:flex">
                  <span className="font-medium">{user.username}</span>
                </div>
              </div>
            )}

            {mobileOpen && (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border lg:hidden"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
