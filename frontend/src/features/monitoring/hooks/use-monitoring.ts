import { useState } from 'react';

export function useMonitoring() {
  const [alerts, setAlerts] = useState<string[]>([]);
  return { alerts, setAlerts };
}
