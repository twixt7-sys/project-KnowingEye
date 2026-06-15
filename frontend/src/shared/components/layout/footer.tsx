import { Logo, InstitutionLogo } from "./logo";
import { Link } from "react-router";
import { brand } from "../../../core/config/brand";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/70 bg-card/50">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-7 text-primary" />
            <div>
              <p className="font-medium">{brand.appName}</p>
              <p className="text-xs text-muted-foreground">{brand.institutionName}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/features" className="hover:text-foreground">
              Features
            </Link>
            <Link to="/examiner" className="hover:text-foreground">
              Examiner
            </Link>
            <Link to="/examinee" className="hover:text-foreground">
              Examinee
            </Link>
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <InstitutionLogo className="h-10 w-10 rounded-md border border-border bg-card p-1" />
            <p className="text-xs text-muted-foreground">{brand.institutionUnit}</p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {currentYear} {brand.appName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
