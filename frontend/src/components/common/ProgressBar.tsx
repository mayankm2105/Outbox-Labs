import React from 'react';
import { cn } from '../../utils/cn';

export interface ProgressBarProps {
  sent?: number;
  failed?: number;
  pending?: number;
  total?: number;
  className?: string;
  showLabels?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  sent = 0,
  failed = 0,
  pending = 0,
  total = 0,
  className,
  showLabels = false,
}) => {
  if (total <= 0) {
    return (
      <div className={cn('w-full', className)}>
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden" />
        {showLabels && <div className="text-[11px] text-slate-400 mt-1">No recipients</div>}
      </div>
    );
  }

  const sentPct = Math.min(100, Math.max(0, (sent / total) * 100));
  const failedPct = Math.min(100 - sentPct, Math.max(0, (failed / total) * 100));
  const pendingPct = Math.min(100 - sentPct - failedPct, Math.max(0, (pending / total) * 100));
  const otherPct = Math.max(0, 100 - sentPct - failedPct - pendingPct);

  return (
    <div className={cn('w-full', className)}>
      <div className="h-2 w-full rounded-full bg-slate-100 flex overflow-hidden shadow-inner">
        {sentPct > 0 && (
          <div
            style={{ width: `${sentPct}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title={`Sent: ${sent} (${sentPct.toFixed(1)}%)`}
          />
        )}
        {pendingPct > 0 && (
          <div
            style={{ width: `${pendingPct}%` }}
            className="bg-amber-400 h-full transition-all duration-500"
            title={`Pending: ${pending} (${pendingPct.toFixed(1)}%)`}
          />
        )}
        {failedPct > 0 && (
          <div
            style={{ width: `${failedPct}%` }}
            className="bg-rose-500 h-full transition-all duration-500"
            title={`Failed: ${failed} (${failedPct.toFixed(1)}%)`}
          />
        )}
        {otherPct > 0 && (
          <div
            style={{ width: `${otherPct}%` }}
            className="bg-slate-300 h-full transition-all duration-500"
            title={`Other: ${total - sent - failed - pending}`}
          />
        )}
      </div>

      {showLabels && (
        <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5 font-medium">
          <span className="text-emerald-700">{sent} sent</span>
          {pending > 0 && <span className="text-amber-700">{pending} pending</span>}
          {failed > 0 && <span className="text-rose-700">{failed} failed</span>}
          <span>{total} total</span>
        </div>
      )}
    </div>
  );
};

