import { RouterProvider } from "react-router";
import { router } from "./core/router";
import { AuthProvider } from "./core/providers/auth-provider";
import { ThemeProvider } from "./core/providers/theme-provider";
import { QueryProvider } from "./core/providers/query-provider";
import { ConfirmProvider } from "./shared/components/common/confirm-dialog";
import { ErrorBoundary } from "./shared/components/common/error-boundary";
import { Toaster } from "./shared/components/ui/sonner";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <ConfirmProvider>
              <RouterProvider router={router} />
            </ConfirmProvider>
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
