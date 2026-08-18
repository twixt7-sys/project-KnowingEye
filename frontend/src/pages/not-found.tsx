import { ArrowLeft, Home } from "@/shared/icons";
import { Link } from "react-router";

import { Button } from "@/shared/components/ui/button";

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="kicker justify-center">Page not found</p>
        <h1 className="mt-4 font-serif text-8xl font-semibold tracking-tight text-primary sm:text-9xl">
          404
        </h1>
        <p className="mx-auto mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          — this record does not exist —
        </p>
        <p className="mx-auto mt-6 max-w-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/">
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
