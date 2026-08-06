import { ChevronLeft, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { brand } from "../../../core/config/brand";
import { examineeNav } from "../../../core/config/examinee-nav";
import { examinerNav } from "../../../core/config/examiner-nav";
import { useAuth } from "../../../core/providers/auth-provider";
import { CommandPalette } from "../common/command-palette";
import { useConfirm } from "../common/confirm-dialog";
import { ThemeToggle } from "../common/theme-toggle";
import { WorkspaceAlertsBell } from "../common/workspace-alerts-bell";
import { Drawer, DrawerContent, DrawerTitle } from "../ui/drawer";
import { cn } from "../ui/utils";
import { Logo } from "./logo";
import { SchoolBackground } from "./school-background";

type WorkspaceRole = "examiner" | "examinee";
type WorkspaceVariant = "default" | "focus";

type WorkspaceLayoutProps = {
  role: WorkspaceRole;
  variant?: WorkspaceVariant;
  children: React.ReactNode;
};

const roleMeta: Record<
  WorkspaceRole,
  { title: string; subtitle: string; nav: typeof examinerNav }
> = {
  examiner: {
    title: "Examiner",
    subtitle: "Control center",
    nav: examinerNav,
  },
  examinee: {
    title: "Examinee",
    subtitle: "Exam workspace",
    nav: examineeNav,
  },
};

function isNavActive(pathname: string, path: string) {
  if (path === "/examiner" || path === "/examinee") {
    return pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function WorkspaceLayout({ role, variant = "default", children }: WorkspaceLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasModule } = useAuth();
  const confirm = useConfirm();
  const meta = roleMeta[role];
  const isFocus = variant === "focus";
  const navItems = meta.nav.filter((item) => !item.module || hasModule(item.module));

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: "Sign out?",
      description: "You will need to sign in again to access your account.",
      confirmLabel: "Sign out",
      destructive: true,
    });
    if (!confirmed) return;
    logout();
    navigate("/");
  };

  const handleExitQuiz = async () => {
    const confirmed = await confirm({
      title: "Leave exam?",
      description:
        "Your answers are only saved when you submit. Leaving now will discard your progress.",
      confirmLabel: "Leave exam",
      cancelLabel: "Stay",
      destructive: true,
    });
    if (!confirmed) return;
    navigate("/examinee");
  };

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        collapsed ? "w-[4.5rem]" : "w-full",
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <Logo className="h-8 w-8 shrink-0 text-sidebar-primary" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-serif text-[0.9375rem] font-semibold leading-tight tracking-tight">
              {brand.appName}
            </p>
            <p className="truncate font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
              {meta.subtitle}
            </p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
        {!collapsed && (
          <p className="mb-2 px-3 pt-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
            {meta.title}
          </p>
        )}
        {navItems.map((item) => {
          const active = isNavActive(location.pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-2 left-0 w-[2.5px] rounded-r bg-sidebar-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <item.icon
                strokeWidth={active ? 2 : 1.75}
                className={cn(
                  "h-4 w-4 shrink-0",
                  active
                    ? "text-sidebar-primary"
                    : "text-muted-foreground group-hover:text-sidebar-foreground",
                )}
              />
              {!collapsed && (
                <span className={cn("truncate", active ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-sidebar-border bg-sidebar p-3">
        {!collapsed && user && (
          <div className="mb-3 flex items-center gap-2.5 rounded-md border border-sidebar-border/70 bg-card/60 px-2.5 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-serif text-sm font-semibold text-sidebar-primary-foreground">
              {(user.username?.[0] ?? "?").toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium leading-tight">
                {user.username}
              </span>
              <span className="block truncate font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                {user.role}
              </span>
            </span>
          </div>
        )}
        <div className={cn("flex gap-2", collapsed ? "flex-col items-center" : "")}>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "w-full" : "flex-1",
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
        {role === "examiner" && <CommandPalette />}
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <button
              type="button"
              onClick={handleExitQuiz}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to exams
            </button>
            <div className="flex items-center gap-2">
              <Logo className="h-6 w-6 text-primary" />
              <span className="hidden font-mono text-xs uppercase tracking-[0.14em] sm:inline">
                {meta.title} session
              </span>
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
      {role === "examiner" && <CommandPalette />}
      <div
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        {sidebar}
      </div>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} direction="left">
        <DrawerContent className="h-full max-h-none w-[min(100%,16rem)] rounded-none border-r p-0">
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          {sidebar}
        </DrawerContent>
      </Drawer>

      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
        <SchoolBackground variant="workspace" />
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent lg:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="live-dot" aria-hidden />
              <p className="truncate font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground">
                {meta.title} workspace
              </p>
            </div>

            {user && (
              <div className="flex items-center gap-2">
                {role === "examiner" && <WorkspaceAlertsBell />}
                <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                  <span className="font-medium">{user.username}</span>
                </div>
              </div>
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
