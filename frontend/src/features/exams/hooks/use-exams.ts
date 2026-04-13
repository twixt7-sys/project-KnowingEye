import { useState, useEffect } from 'react';

export function useExams() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    setItems([]);
  }, []);

  return { items };
}
