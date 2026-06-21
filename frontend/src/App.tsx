import { RouterProvider } from "react-router";
import { router } from "./core/router";
import { AuthProvider } from "./core/providers/auth-provider";
import { ThemeProvider } from "./core/providers/theme-provider";
import { QueryProvider } from "./core/providers/query-provider";
import { ErrorBoundary } from "./shared/components/common/error-boundary";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
