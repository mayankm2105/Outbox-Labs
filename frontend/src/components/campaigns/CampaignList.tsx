import React from 'react';
import { Megaphone, AlertCircle, RefreshCw } from 'lucide-react';
import { CampaignCard } from './CampaignCard';
import { Pagination } from '../common/Pagination';
import { EmptyState } from '../common/EmptyState';
import { Skeleton } from '../common/Skeleton';
import { Button } from '../common/Button';
import { useCampaigns } from '../../hooks/useCampaigns';

export interface CampaignListProps {
  page: number;
  onPageChange: (newPage: number) => void;
  onSelectCampaign: (campaignId: string) => void;
  onOpenCompose: () => void;
}

export const CampaignList: React.FC<CampaignListProps> = ({
  page,
  onPageChange,
  onSelectCampaign,
  onOpenCompose,
}) => {
  const { campaigns, pagination, isLoading, isError, error, refetch } = useCampaigns({
    page,
    limit: 9,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-1/2" />
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
        <h4 className="text-sm font-semibold text-slate-800 mb-1">Failed to load campaigns</h4>
        <p className="text-xs text-slate-500 mb-4 max-w-sm">
          {(error as any)?.message || 'Could not query campaigns list.'}
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

  if (!campaigns || campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No campaigns scheduled yet"
        description="Create your first email campaign to schedule sequential dispatches with rate-limit protection."
        actionLabel="Compose New Email"
        onAction={onOpenCompose}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((camp) => (
          <CampaignCard
            key={camp.id}
            campaign={camp}
            onClick={() => onSelectCampaign(camp.id)}
          />
        ))}
      </div>

      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
};

