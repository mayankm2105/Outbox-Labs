import React, { useState } from 'react';
import { Calendar, Users, XCircle, ArrowUpRight } from 'lucide-react';
import { EmailCampaign } from '../../types/api';
import { getCampaignStatusStyles } from '../../utils/status.util';
import { formatDate } from '../../utils/date.util';
import { ProgressBar } from '../common/ProgressBar';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useCampaigns } from '../../hooks/useCampaigns';

export interface CampaignCardProps {
  campaign: EmailCampaign;
  onClick: () => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onClick }) => {
  const { cancelCampaign, isCancelling } = useCampaigns();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  const statusStyle = getCampaignStatusStyles(campaign.status);
  const stats = campaign.stats || {
    total: campaign.totalRecipients,
    SENT: 0,
    FAILED: 0,
    SCHEDULED: campaign.totalRecipients,
    PROCESSING: 0,
    RETRY_SCHEDULED: 0,
    CANCELLED: 0,
    DELIVERY_UNKNOWN: 0,
  };

  const pendingCount = (stats.SCHEDULED || 0) + (stats.PROCESSING || 0) + (stats.RETRY_SCHEDULED || 0);

  // Section 7.2: Cancel eligibility check
  const isCancellableStatus = ['SCHEDULED', 'PROCESSING', 'PARTIALLY_COMPLETED'].includes(
    campaign.status,
  );
  const hasCancellableEmails = (stats.SCHEDULED || 0) + (stats.RETRY_SCHEDULED || 0) > 0;
  const isCancelEligible = isCancellableStatus && hasCancellableEmails;

  const handleConfirmCancel = async () => {
    await cancelCampaign(campaign.id);
    setIsCancelConfirmOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 cursor-pointer" onClick={onClick}>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyle.badge}`}
              >
                {statusStyle.label}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {campaign.senderAccount?.email || 'Sender'}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-1.5 line-clamp-1 hover:text-indigo-600 transition">
              {campaign.subject}
            </h3>
          </div>

          <button
            onClick={onClick}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
            title="View campaign details"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar with Segment Breakdown */}
        <div className="space-y-1.5 cursor-pointer" onClick={onClick}>
          <ProgressBar
            sent={stats.SENT}
            failed={stats.FAILED}
            pending={pendingCount}
            total={campaign.totalRecipients}
            showLabels
          />
        </div>

        {/* Footer Meta + Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDate(campaign.startAt)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {campaign.totalRecipients} recipients
            </span>
          </div>

          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelConfirmOpen(true)}
              disabled={!isCancelEligible}
              className="text-xs py-1 h-7 border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300"
              title={
                !isCancelEligible
                  ? 'No pending emails to cancel'
                  : 'Cancel pending emails for this campaign'
              }
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Campaign?"
        message="Pending and scheduled emails will not be sent. Emails currently in processing or already sent cannot be undone."
        confirmLabel="Cancel Campaign"
        variant="danger"
        isLoading={isCancelling}
      />
    </>
  );
};

