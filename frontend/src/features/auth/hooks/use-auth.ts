import { useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);

  return {
    user,
    login: async () => {
      setUser({ id: 0, username: 'guest', role: 'EXAMINEE' });
    },
    logout: () => setUser(null),
  };
}
