export const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <span
    className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    role="status"
    aria-label="Loading"
  />
);

export const SkeletonCard = () => (
  <div className="card space-y-3 p-4">
    <div className="flex items-center justify-between">
      <div className="skeleton h-5 w-32" />
      <div className="skeleton h-6 w-20" />
    </div>
    <div className="skeleton h-4 w-2/3" />
    <div className="skeleton h-4 w-1/2" />
    <div className="flex gap-2">
      <div className="skeleton h-9 w-24" />
      <div className="skeleton h-9 w-24" />
    </div>
  </div>
);
