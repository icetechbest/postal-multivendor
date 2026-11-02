'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h2>حدث خطأ غير متوقع / Something went wrong</h2>
      <button
        type="button"
        onClick={() => reset()}
        style={{ padding: '8px 20px', cursor: 'pointer' }}
      >
        إعادة المحاولة / Try again
      </button>
    </div>
  );
}
