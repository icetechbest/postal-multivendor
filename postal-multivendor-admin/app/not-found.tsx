import Link from 'next/link';

export default function NotFound() {
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
      <h2>الصفحة غير موجودة / Page not found</h2>
      <Link href="/">الرئيسية / Home</Link>
    </div>
  );
}
