import { useEffect, useState } from 'react';

/** Returns a value that only updates after the caller stops changing it. */
export const useDebouncedValue = <T,>(value: T, delay = 350): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};
