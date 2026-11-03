import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { CampaignList } from '../components/campaigns/CampaignList';
import { CampaignDetailModal } from '../components/campaigns/CampaignDetailModal';
import { EmailDetailDrawer } from '../components/emails/EmailDetailDrawer';
import { ScheduleModal } from '../components/campaigns/ScheduleModal';
import { Button } from '../components/common/Button';

export const CampaignsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Compose Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Campaigns</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage scheduled batches, inspect delivery segment progress, and cancel active queues.
          </p>
        </div>
        <div>
          <Button
            onClick={() => setIsComposeOpen(true)}
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Campaign
          </Button>
        </div>
      </div>

      {/* Campaign List Grid */}
      <CampaignList
        page={page}
        onPageChange={setPage}
        onSelectCampaign={setSelectedCampaignId}
        onOpenCompose={() => setIsComposeOpen(true)}
      />

      {/* Campaign Breakdown Modal */}
      <CampaignDetailModal
        campaignId={selectedCampaignId}
        onClose={() => setSelectedCampaignId(null)}
        onEmailRowClick={(emailId) => setSelectedEmailId(emailId)}
      />

      {/* Email Lifecycle Audit Drawer */}
      <EmailDetailDrawer
        emailId={selectedEmailId}
        onClose={() => setSelectedEmailId(null)}
      />

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
};

