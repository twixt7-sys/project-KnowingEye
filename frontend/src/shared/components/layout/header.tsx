import { Logo } from "./logo";
import { ThemeToggle } from "../common/theme-toggle";
import { Menu, X, User, LogOut } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../../core/providers/auth-provider";
import { brand } from "../../../core/config/brand";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();

  const navItems: { name: string; path: string }[] = [
    { name: "Home", path: "/" },
    { name: "Examiner", path: "/examiner" },
    { name: "Examinee", path: "/examinee" },
    { name: "Features", path: "/features" },
    { name: "About", path: "/about" },
  ];

  if (isAuthenticated) {
    if (isAdmin) {
      navItems.push({ name: "Monitoring", path: "/monitoring" });
      navItems.push({ name: "Reports", path: "/reports" });
      navItems.push({ name: "Users", path: "/users" });
    }
    navItems.push({ name: "Profile", path: "/profile" });
  }

  const isActive = (path: string) => {
    if (path === "/examiner" || path === "/examinee") {
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    }
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    setMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and brand */}
          <Link to="/" className="flex items-center gap-3">
            <Logo className="w-8 h-8 text-primary" />
            <span className="text-xl font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {brand.appName}
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm transition-colors ${
                  isActive(item.path)
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />

            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                {/* User info */}
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {user?.username} ({user?.role})
                  </span>
                </div>

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="hidden md:inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Sign In
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-border mt-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                  isActive(item.path)
                    ? "bg-accent text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {item.name}
              </Link>
            ))}

            {isAuthenticated ? (
              <div className="px-4 py-2 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>{user?.username} ({user?.role})</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block mx-4 mt-4 text-center rounded-lg px-4 py-2 text-sm bg-primary text-primary-foreground"
              >
                Sign In
              </Link>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}