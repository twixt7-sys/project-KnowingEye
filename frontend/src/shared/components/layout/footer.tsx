import { Link } from "react-router";
import { brand } from "../../../core/config/brand";
import { DepartmentLogo, InstitutionLogo, Logo } from "./logo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/70 bg-card/60">
      <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-[1fr_auto_auto] sm:items-start">
          <div>
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-8 text-primary" />
              <div>
                <p className="font-serif text-base font-semibold tracking-tight">{brand.appName}</p>
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {brand.tagline}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Secure, monitored online examinations for {brand.institutionName}.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="mb-3 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              Explore
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/features" className="transition-colors hover:text-foreground">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/examiner" className="transition-colors hover:text-foreground">
                  Examiner portal
                </Link>
              </li>
              <li>
                <Link to="/examinee" className="transition-colors hover:text-foreground">
                  Examinee portal
                </Link>
              </li>
              <li>
                <Link to="/about" className="transition-colors hover:text-foreground">
                  About
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="mb-3 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              Institution
            </p>
            <div className="flex items-center gap-3">
              <div className="logo-duo">
                <InstitutionLogo className="h-10 w-10 rounded-md border border-border bg-card p-1" />
                <DepartmentLogo className="h-10 w-10 rounded-md border border-border bg-card p-1" />
              </div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">{brand.institutionName}</p>
                <p>{brand.departmentName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-5 sm:flex-row">
          <p className="font-mono text-[0.6875rem] tracking-[0.06em] text-muted-foreground">
            © {currentYear} {brand.appName} — all rights reserved
          </p>
          <p className="font-mono text-[0.6875rem] tracking-[0.06em] text-muted-foreground/70">
            fair assessment · academic integrity
          </p>
        </div>
      </div>
    </footer>
  );
}
