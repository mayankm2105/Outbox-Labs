import React, { useState } from 'react';
import { Clock, CheckCircle2, AlertOctagon, Megaphone } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { EmailTable } from '../components/emails/EmailTable';
import { EmailDetailDrawer } from '../components/emails/EmailDetailDrawer';
import { useEmails } from '../hooks/useEmails';
import { useCampaigns } from '../hooks/useCampaigns';
import { cn } from '../utils/cn';

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'failed'>('scheduled');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // Queries for real-time counts across the 4 stat cards
  const { data: scheduledData } = useEmails({ variant: 'scheduled', page: 1, limit: 1 });
  const { data: sentData } = useEmails({ variant: 'sent', page: 1, limit: 1 });
  const { data: failedData } = useEmails({ variant: 'failed', page: 1, limit: 1 });
  const { data: campaignsData } = useCampaigns({ page: 1, limit: 1 });

  const scheduledTotal = scheduledData?.pagination.total ?? 0;
  const sentTotal = sentData?.pagination.total ?? 0;
  const failedTotal = failedData?.pagination.total ?? 0;
  const campaignsTotal = campaignsData?.pagination.total ?? 0;

  const tabs = [
    { id: 'scheduled' as const, label: 'Scheduled Queue', count: scheduledTotal, icon: Clock },
    { id: 'sent' as const, label: 'Sent History', count: sentTotal, icon: CheckCircle2 },
    { id: 'failed' as const, label: 'Failed Deliveries', count: failedTotal, icon: AlertOctagon },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Live monitoring of asynchronous email jobs, rate-limited queues, and delivery statuses.
        </p>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Scheduled Queue"
          value={scheduledTotal}
          subtitle="Waiting in BullMQ"
          variant="default"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Delivered"
          value={sentTotal}
          subtitle="SMTP Accepted"
          variant="success"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          title="Failed Dispatches"
          value={failedTotal}
          subtitle="Permanent / Exhausted"
          variant="danger"
          icon={<AlertOctagon className="w-5 h-5" />}
        />
        <StatCard
          title="Active Campaigns"
          value={campaignsTotal}
          subtitle="Total Configured"
          variant="warning"
          icon={<Megaphone className="w-5 h-5" />}
        />
      </div>

      {/* Email Queue Explorer Section */}
      <div className="space-y-4">
        {/* Custom Tab Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all -mb-px',
                  isActive
                    ? 'border-indigo-600 text-indigo-700 bg-white/60'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Table */}
        <EmailTable
          key={activeTab}
          variant={activeTab}
          onRowClick={(id) => setSelectedEmailId(id)}
        />
      </div>

      {/* Email Detail & Audit Trail Drawer */}
      <EmailDetailDrawer
        emailId={selectedEmailId}
        onClose={() => setSelectedEmailId(null)}
      />
    </div>
  );
};

