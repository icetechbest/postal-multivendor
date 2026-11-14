'use client';

interface IWalletStatCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'success' | 'warn';
  hint?: string;
  loading?: boolean;
}

const TONES: Record<string, string> = {
  default: '',
  danger: 'text-red-600 dark:text-red-400',
  success: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
};

export default function WalletStatCard({
  label,
  value,
  tone = 'default',
  hint,
  loading,
}: IWalletStatCardProps) {
  return (
    <div className="card flex min-h-24 flex-col justify-between border border-gray-200 bg-white dark:border-dark-600 dark:bg-dark-900 dark:text-white">
      <span className="text-sm text-gray-600 dark:text-white">{label}</span>
      <div className={`mt-1 text-xl font-bold ${TONES[tone]}`}>
        {loading ? '...' : value}
      </div>
      {hint ? (
        <span className="mt-1 text-xs text-gray-500 dark:text-gray-300">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
