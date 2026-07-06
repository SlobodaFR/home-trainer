import { useCallback, useEffect, useRef, useState } from 'react';

const REST_DURATION = 90;

export function useRestTimer() {
  const [remaining, setRemaining] = useState(REST_DURATION);
  const [active, setActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    audioCtxRef.current ??= new AudioContext();
    const ctx = audioCtxRef.current;
    void ctx.resume().then(() => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    });
  }, []);

  const dismiss = useCallback(() => {
    const interval = intervalRef.current;
    if (interval !== null) {
      clearInterval(interval);
      intervalRef.current = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(() => {
    const existing = intervalRef.current;
    if (existing !== null) {
      clearInterval(existing);
    }
    setRemaining(REST_DURATION);
    setActive(true);
    let count = REST_DURATION;
    intervalRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        const interval = intervalRef.current;
        if (interval !== null) {
          clearInterval(interval);
          intervalRef.current = null;
        }
        setActive(false);
        setRemaining(0);
        playBeep();
      } else {
        setRemaining(count);
      }
    }, 1000);
  }, [playBeep]);

  useEffect(() => {
    return () => {
      const interval = intervalRef.current;
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, []);

  return { remaining, active, start, dismiss };
}
