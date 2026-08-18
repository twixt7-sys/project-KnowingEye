import { type ReactNode } from 'react';
import { ThemeProvider as NextThemeProvider } from 'next-themes';

/**
 * Defaults to light, not system. Directive Area 02 ("Tone & theme") - the
 * panel saw an overly dark app by default; `defaultTheme="system"` meant
 * any visitor on a dark-mode OS got the dark palette with no way to know a
 * lighter one existed. `next-themes` is the single source of truth for the
 * `dark` class on `<html>` - see `shared/components/common/theme-toggle.tsx`,
 * which used to fight this provider with its own manual class toggling.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemeProvider>
  );
}
