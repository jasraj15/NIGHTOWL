import { useEffect, useRef, useState } from 'react';

/**
 * Countdown that trusts the SERVER's clock. We compute the skew between the
 * server time (sent with each pool payload) and the browser's clock once, then
 * tick locally. A client with a wrong clock still sees the right remaining time.
 */
export function useCountdown(closingTime: string | undefined, serverTime?: string) {
  const skewRef = useRef(0);
  const [seconds, setSeconds] = useState<number>(() => compute(closingTime, 0));

  useEffect(() => {
    if (serverTime) skewRef.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);

  useEffect(() => {
    setSeconds(compute(closingTime, skewRef.current));
    if (!closingTime) return;
    const id = setInterval(() => setSeconds(compute(closingTime, skewRef.current)), 1000);
    return () => clearInterval(id);
  }, [closingTime, serverTime]);

  return { seconds, expired: seconds <= 0, urgent: seconds > 0 && seconds <= 5 * 60 };
}

function compute(closingTime: string | undefined, skew: number): number {
  if (!closingTime) return 0;
  const now = Date.now() + skew;
  return Math.max(0, Math.round((new Date(closingTime).getTime() - now) / 1000));
}
