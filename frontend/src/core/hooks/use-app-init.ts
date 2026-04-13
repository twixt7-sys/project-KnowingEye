import { useEffect } from 'react';

export function useAppInit() {
  useEffect(() => {
    // Initialize app-level resources, auth checks, feature flags, or analytics here.
  }, []);
}
