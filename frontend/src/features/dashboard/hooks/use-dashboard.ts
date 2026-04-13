import { useState } from 'react';

export function useDashboard() {
  const [stats, setStats] = useState([]);
  return { stats, setStats };
}
