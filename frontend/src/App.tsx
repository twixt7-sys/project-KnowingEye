import { RouterProvider } from "react-router";
import { router } from "./core/router";
import { AuthProvider } from "./core/providers/auth-provider";
import { ThemeProvider } from "./core/providers/theme-provider";
import { QueryProvider } from "./core/providers/query-provider";

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
