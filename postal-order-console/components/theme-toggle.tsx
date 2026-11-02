'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      className="btn-ghost px-2.5 py-1.5 text-xs"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {mounted ? (isDark ? '☀️' : '🌙') : '🌓'}
    </button>
  );
};
