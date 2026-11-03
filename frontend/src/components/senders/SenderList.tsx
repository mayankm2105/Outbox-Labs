import React from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useSenders } from '../../hooks/useSenders';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { formatDate } from '../../utils/date.util';

export interface SenderListProps {
  onOpenAddSender: () => void;
}

export const SenderList: React.FC<SenderListProps> = ({ onOpenAddSender }) => {
  const { senders, isLoading, isError, error, refetch } = useSenders();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800 mb-1">Failed to load sender accounts</h4>
        <p className="text-xs text-slate-500 mb-4 max-w-sm">
          {(error as any)?.message || 'Could not query configured senders.'}
        </p>
        <Button
          onClick={() => refetch()}
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (senders.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No sender accounts configured"
        description="Add your first SMTP sender identity to begin dispatching email campaigns."
        actionLabel="Configure Sender"
        onAction={onOpenAddSender}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {senders.map((sender) => (
        <div
          key={sender.id}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-slate-300 transition"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                  {sender.displayName || 'Sender'}
                </h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{sender.email}</p>
              </div>
            </div>

            {sender.isActive ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> Active
              </Badge>
            ) : (
              <Badge variant="neutral">Inactive</Badge>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Host:</span>
              <span className="text-slate-700">{sender.smtpHost}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Port:</span>
              <span className="text-slate-700">{sender.smtpPort}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Added:</span>
              <span className="text-slate-700">{formatDate(sender.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

