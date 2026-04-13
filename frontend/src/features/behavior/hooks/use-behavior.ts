import { useState } from 'react';

export function useBehavior() {
  const [behaviorLog, setBehaviorLog] = useState<string[]>([]);
  return { behaviorLog, setBehaviorLog };
}
