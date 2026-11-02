'use client';
import { useEffect, useState } from 'react';

/** True when viewport is phone-width (<768). Desktop layouts must ignore this. */
export function useIsMobile(breakpointPx = 767): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [breakpointPx]);
  return mobile;
}
