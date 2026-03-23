import { Outlet, useLocation } from "react-router";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

export function Root() {
  const location = useLocation();
  const hideHeaderFooter = location.pathname === "/login";

  return (
    <div className="bg-dark-grid min-h-screen flex flex-col position-relative">
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
