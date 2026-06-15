import { Link, useLocation, useNavigate } from "react-router";
import { Logo } from "./logo";
import { ThemeToggle } from "../common/theme-toggle";
import { Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../core/providers/auth-provider";
import { brand } from "../../../core/config/brand";
import { Button } from "../ui/button";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Features", path: "/features" },
    { name: "About", path: "/about" },
  ];

  const portals = [
    { name: "Examiner", path: "/examiner" },
    { name: "Examinee", path: "/examinee" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/");
    setMobileMenuOpen(false);
  };

  return (
    <header className="public-header fixed top-0 z-50 w-full">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="public-header-brand flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">{brand.appName}</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`public-header-link ${isActive(item.path) ? "public-header-link--active" : ""}`}
              >
                {item.name}
              </Link>
            ))}
            <span className="public-header-divider mx-2 h-4 w-px" aria-hidden />
            {portals.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`public-header-link ${
                  isActive(item.path) ? "public-header-link--portal-active" : ""
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="public-header-theme-toggle" />
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="public-header-btn-outline hidden sm:inline-flex"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            ) : (
              <Button asChild size="sm" className="public-header-btn-cta hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="public-header-menu-btn inline-flex h-9 w-9 items-center justify-center rounded-md md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="public-header-mobile space-y-1 border-t py-3 md:hidden">
            {[...navItems, ...portals].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="public-header-mobile-link block rounded-md px-3 py-2 text-sm"
              >
                {item.name}
              </Link>
            ))}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="public-header-mobile-link mt-2 w-full rounded-md px-3 py-2 text-left text-sm"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="public-header-btn-cta mt-2 block rounded-md px-3 py-2 text-center text-sm"
              >
                Sign in
              </Link>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
