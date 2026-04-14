import { Outlet, useLocation } from "react-router";
import { Header } from "../../shared/components/layout/header";
import { Footer } from "../../shared/components/layout/footer";

export function Root() {
  const location = useLocation();

  // Hide header/footer on login page, or show them on all other pages
  const hideHeaderFooter = location.pathname === "/login";

  return (
    <div className="bg-dark-grid min-h-screen flex flex-col position-relative">
      <span className="h-15"></span>
      {/* Animated Grid Background */}
      <div className="soft-light"></div>
      <div className="grid-background"/>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {!hideHeaderFooter && <Header />}
        <main className="flex-1">
          <Outlet />
        </main>
        {!hideHeaderFooter && <Footer />}
      </div>
    </div>
  );
}
