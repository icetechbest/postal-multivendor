'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'poc-sound-enabled';

/** Short two-tone chime generated with WebAudio — no asset download required. */
export const useSound = () => {
  const [enabled, setEnabled] = useState(true);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setEnabled(stored === 'true');
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const play = useCallback(() => {
    if (!enabled) return;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = contextRef.current ?? new AudioContextCtor();
      contextRef.current = context;
      if (context.state === 'suspended') void context.resume();

      const now = context.currentTime;
      [880, 1174].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.25, now + index * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.18 + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + index * 0.18);
        oscillator.stop(now + index * 0.18 + 0.18);
      });
    } catch {
      // Audio is best-effort; never break the queue for it.
    }
  }, [enabled]);

  return { enabled, toggle, play };
};
