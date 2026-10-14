import { useEffect, useState } from 'react';

/**
 * Whole seconds left until `untilMs` (epoch ms), updated every 250ms.
 * Returns 0 once the deadline passes or when there is none.
 */
export function useCountdown(untilMs: number | null): number {
  const compute = () => (untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - Date.now()) / 1000)));
  const [seconds, setSeconds] = useState(compute);

  useEffect(() => {
    setSeconds(compute());
    if (untilMs === null) return;
    const id = window.setInterval(() => {
      const next = compute();
      setSeconds(next);
      if (next === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [untilMs]);

  return seconds;
}
