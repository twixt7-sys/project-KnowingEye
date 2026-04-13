import { useState } from 'react';

export function useSession() {
  const [session, setSession] = useState(null);
  return { session, setSession };
}
