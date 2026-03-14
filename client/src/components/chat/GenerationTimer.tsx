import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';

interface GenerationTimerProps {
  isGenerating: boolean;
}

export function GenerationTimer({ isGenerating }: GenerationTimerProps): JSX.Element | null {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isGenerating) {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGenerating]);

  if (!isGenerating) return null;

  return <span className="text-[10px] text-[var(--color-text-muted)]/60 tabular-nums">{seconds}с</span>;
}
