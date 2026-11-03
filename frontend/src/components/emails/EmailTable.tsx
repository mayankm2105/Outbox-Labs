import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Inbox, MailCheck, AlertOctagon } from 'lucide-react';
import { useEmails } from '../../hooks/useEmails';
import { useDebounce } from '../../hooks/useDebounce';
import { EmailFilters } from './EmailFilters';
import { TableSkeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { Pagination } from '../common/Pagination';
import { Button } from '../common/Button';
import { getEmailStatusStyles } from '../../utils/status.util';
import { formatDate } from '../../utils/date.util';

export interface EmailTableProps {
  variant: 'scheduled' | 'sent' | 'failed' | 'campaign';
  campaignId?: string;
  onRowClick: (emailId: string) => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({ variant, campaignId, onRowClick }) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error, refetch } = useEmails({
    variant,
    page,
    limit,
    search: debouncedSearch || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    campaignId,
  });

  const emptyCopy = {
    scheduled: {
      title: 'No scheduled emails',
      description: 'You have no emails waiting in the schedule queue. Compose a new campaign to begin.',
      icon: Inbox,
    },
    sent: {
      title: 'No delivered emails',
      description: 'Delivered email dispatches will appear here once accepted by the SMTP provider.',
      icon: MailCheck,
    },
    failed: {
      title: 'No delivery failures',
      description: 'All email deliveries are healthy or pending. No delivery errors recorded.',
      icon: AlertOctagon,
    },
    campaign: {
      title: 'No campaign recipient records',
      description: 'No recipient records found for this campaign.',
      icon: Inbox,
    },
  }[variant];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Search & Date Filter Bar */}
      {variant !== 'campaign' && (
        <EmailFilters
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          startDate={startDate}
          onStartDateChange={(val) => {
            setStartDate(val);
            setPage(1);
          }}
          endDate={endDate}
          onEndDateChange={(val) => {
            setEndDate(val);
            setPage(1);
          }}
          showDateFilters={variant === 'sent'}
        />
      )}

      {/* Explicit Render Branch: Loading */}
      {isLoading ? (
        <TableSkeleton rows={8} columns={variant === 'failed' ? 5 : 4} />
      ) : isError ? (
        /* Explicit Render Branch: Error */
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">Failed to load emails</h4>
          <p className="text-xs text-slate-500 mb-4 max-w-sm">
            {(error as any)?.message || 'A network error occurred while querying email records.'}
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
      ) : !data || data.items.length === 0 ? (
        /* Explicit Render Branch: Empty */
        <div className="p-6">
          <EmptyState
            icon={emptyCopy.icon}
            title={emptyCopy.title}
            description={emptyCopy.description}
          />
        </div>
      ) : (
        /* Explicit Render Branch: Populated Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Subject</th>
                {variant === 'scheduled' && <th className="py-3 px-4">Scheduled For</th>}
                {variant === 'sent' && <th className="py-3 px-4">Sent Time</th>}
                {variant === 'failed' && (
                  <>
                    <th className="py-3 px-4">Error Code</th>
                    <th className="py-3 px-4">Error Description</th>
                    <th className="py-3 px-4">Retries</th>
                  </>
                )}
                {variant === 'campaign' && <th className="py-3 px-4">Delivery Time</th>}
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((email) => {
                const statusStyle = getEmailStatusStyles(email.status);

                return (
                  <tr
                    key={email.id}
                    onClick={() => onRowClick(email.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 max-w-[200px] truncate">
                      {email.recipientEmail}
                    </td>

                    <td className="py-3 px-4 text-slate-700 max-w-[220px] truncate">
                      {email.subject || email.campaign?.subject || '—'}
                    </td>

                    {variant === 'scheduled' && (
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {formatDate(email.scheduledAt)}
                      </td>
                    )}

                    {variant === 'sent' && (
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {formatDate(email.sentAt)}
                      </td>
                    )}

                    {variant === 'failed' && (
                      <>
                        <td className="py-3 px-4 font-mono text-rose-700 font-bold whitespace-nowrap">
                          {email.errorCode || 'UNKNOWN'}
                        </td>
                        <td
                          className="py-3 px-4 font-mono text-rose-600 max-w-[220px] truncate"
                          title={email.errorMessage || ''}
                        >
                          {email.errorMessage || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {email.retryCount || 0}
                        </td>
                      </>
                    )}

                    {variant === 'campaign' && (
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {email.sentAt ? formatDate(email.sentAt) : formatDate(email.scheduledAt)}
                      </td>
                    )}

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyle.badge}`}
                      >
                        {statusStyle.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination bar */}
          <Pagination
            pagination={data.pagination}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}
    </div>
  );
};
