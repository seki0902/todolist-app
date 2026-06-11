import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} />
);

export const TaskSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50">
    <Skeleton className="h-4 w-4 rounded" />
    <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>
    </div>
    <Skeleton className="h-4 w-12 rounded" />
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
    <Skeleton className="h-8 w-16 rounded" />
    <Skeleton className="h-3 w-20 rounded" />
  </div>
);

export const FocusCardSkeleton: React.FC = () => (
  <div className="mx-8 mb-6 rounded-2xl border bg-card/50 p-6 space-y-3">
    <Skeleton className="h-5 w-24 rounded-full" />
    <Skeleton className="h-7 w-64 rounded" />
    <Skeleton className="h-4 w-full rounded" />
    <Skeleton className="h-4 w-3/4 rounded" />
    <div className="flex gap-3 pt-2">
      <Skeleton className="h-9 w-32 rounded-xl" />
      <Skeleton className="h-9 w-24 rounded-xl" />
    </div>
  </div>
);
