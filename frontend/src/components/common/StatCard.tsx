import React from 'react';
import { cn } from '../../utils/cn';

export interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  variant = 'default',
  className,
}) => {
  const iconBgs = {
    default: 'bg-indigo-50 text-indigo-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between',
        className,
      )}
    >
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className={cn('p-3 rounded-xl shrink-0', iconBgs[variant])}>{icon}</div>
    </div>
  );
};

