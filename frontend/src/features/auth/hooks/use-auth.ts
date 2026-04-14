import { useState } from 'react';

type AuthUser = {
  id: number;
  username: string;
  role: 'ADMIN' | 'EXAMINEE';
} | null;

export function useAuth() {
  const [user, setUser] = useState<AuthUser>(null);

  return {
    user,
    login: async () => {
      setUser({ id: 0, username: 'guest', role: 'EXAMINEE' });
    },
    logout: () => setUser(null),
  };
}
