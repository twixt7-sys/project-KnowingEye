import { useState } from 'react';

export function useReports() {
  const [reports, setReports] = useState<any[]>([]);
  return { reports, setReports };
}
