import type { ReactNode } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
import { SchoolBackground } from "./school-background";

type PublicLayoutProps = {
  children: ReactNode;
  /** Center content vertically (landing pages). */
  centered?: boolean;
};

export function PublicLayout({ children, centered = true }: PublicLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SchoolBackground variant="public" fixed />
      <span className="relative z-10 h-16" aria-hidden />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main
          className={
            centered
              ? "flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16"
              : "flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10"
          }
        >
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
