import React from 'react';
import { Clock, ShieldCheck, AlertOctagon, XCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useCampaignDetail } from '../../hooks/useCampaignDetail';
import { EmailTable } from '../emails/EmailTable';
import { ProgressBar } from '../common/ProgressBar';
import { getCampaignStatusStyles } from '../../utils/status.util';
import { formatDate } from '../../utils/date.util';

export interface CampaignDetailModalProps {
  campaignId: string | null;
  onClose: () => void;
  onEmailRowClick: (emailId: string) => void;
}

export const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  campaignId,
  onClose,
  onEmailRowClick,
}) => {
  const { data: campaign, isLoading, isError, error } = useCampaignDetail(campaignId);

  return (
    <Modal
      isOpen={Boolean(campaignId)}
      onClose={onClose}
      title="Campaign Breakdown"
      description={campaign?.subject}
      maxWidth="3xl"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading campaign breakdown...</p>
        </div>
      ) : isError || !campaign ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <p className="font-semibold mb-1">Failed to load campaign</p>
          <p className="text-xs">{(error as any)?.message || 'Campaign not found'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  getCampaignStatusStyles(campaign.status).badge
                }`}
              >
                {getCampaignStatusStyles(campaign.status).label}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Started: {formatDate(campaign.startAt)}
              </span>
            </div>

            <div className="text-xs text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60">
              <div>
                <span className="text-slate-400 block text-[11px]">SENDER</span>
                <span className="font-medium text-slate-900 truncate block">
                  {campaign.senderAccount?.email || 'Default'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">DELAY</span>
                <span className="font-medium text-slate-900">{campaign.delaySeconds}s interval</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">HOURLY LIMIT</span>
                <span className="font-medium text-slate-900">{campaign.hourlyLimit} / hr</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">TOTAL RECIPIENTS</span>
                <span className="font-medium text-slate-900">{campaign.totalRecipients}</span>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="pt-2">
              <ProgressBar
                sent={campaign.stats?.SENT}
                failed={campaign.stats?.FAILED}
                pending={
                  (campaign.stats?.SCHEDULED || 0) +
                  (campaign.stats?.PROCESSING || 0) +
                  (campaign.stats?.RETRY_SCHEDULED || 0)
                }
                total={campaign.totalRecipients}
                showLabels
              />
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-emerald-900">{campaign.stats?.SENT || 0}</div>
              <div className="text-[11px] text-emerald-700 font-medium">Delivered</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
              <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-900">
                {(campaign.stats?.SCHEDULED || 0) + (campaign.stats?.PROCESSING || 0)}
              </div>
              <div className="text-[11px] text-blue-700 font-medium">Pending / Active</div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
              <AlertOctagon className="w-4 h-4 text-rose-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-rose-900">{campaign.stats?.FAILED || 0}</div>
              <div className="text-[11px] text-rose-700 font-medium">Failed</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <XCircle className="w-4 h-4 text-slate-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-slate-800">
                {campaign.stats?.CANCELLED || 0}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Cancelled</div>
            </div>
          </div>

          {/* Embedded Recipient Email Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Recipient Email Work Units
            </h4>
            <EmailTable
              variant="campaign"
              campaignId={campaign.id}
              onRowClick={onEmailRowClick}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};
