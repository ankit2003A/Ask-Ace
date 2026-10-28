import { useEffect, useState } from "react";

/* Seconds since `startedAt`, ticking while it is set.

   Pass a timestamp to start and null to stop. The ticking is driven by an
   interval rather than a setState during render, so a stopped timer costs
   nothing. */
export function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt === null) return 0;
  // `now` is from the last tick, so clamp until the first one lands.
  return Math.max(0, (now - startedAt) / 1000);
}

export const seconds = (value) => `${value.toFixed(1)}s`;
