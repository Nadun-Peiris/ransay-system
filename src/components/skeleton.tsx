type SkeletonTableProps = {
  columns?: number;
  rows?: number;
};

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-stone-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonTable({ columns = 5, rows = 6 }: SkeletonTableProps) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(120px, 1fr))`,
          }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <SkeletonBlock
              key={columnIndex}
              className={columnIndex === 0 ? "h-5" : "h-4"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="mt-4 h-8 w-36" />
          <SkeletonBlock className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
