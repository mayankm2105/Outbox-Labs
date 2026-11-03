import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200/80', className)}
      {...props}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="w-full divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="py-4 px-6 flex items-center gap-4">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={cn(
                'h-4',
                cIdx === 0 && 'w-1/3',
                cIdx === 1 && 'w-1/4',
                cIdx === 2 && 'w-1/6',
                cIdx === 3 && 'w-16 ml-auto',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

