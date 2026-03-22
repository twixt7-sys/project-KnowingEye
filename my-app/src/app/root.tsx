import { Outlet, useLocation } from "react-router";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

export function Root() {
  const location = useLocation();
  const hideHeaderFooter = location.pathname === "/login";

  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeaderFooter && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!hideHeaderFooter && <Footer />}
    </div>
  );
}
