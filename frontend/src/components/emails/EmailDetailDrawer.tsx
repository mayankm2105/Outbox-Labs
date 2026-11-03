import React from 'react';
import { Calendar, Send, ShieldAlert, Loader2 } from 'lucide-react';
import { Drawer } from '../common/Drawer';
import { Badge } from '../common/Badge';
import { EventTimeline } from './EventTimeline';
import { useEmailDetail } from '../../hooks/useEmailDetail';
import { getEmailStatusStyles } from '../../utils/status.util';
import { formatDate } from '../../utils/date.util';

export interface EmailDetailDrawerProps {
  emailId: string | null;
  onClose: () => void;
}

export const EmailDetailDrawer: React.FC<EmailDetailDrawerProps> = ({ emailId, onClose }) => {
  const { data: email, isLoading, isError, error } = useEmailDetail(emailId);

  return (
    <Drawer
      isOpen={Boolean(emailId)}
      onClose={onClose}
      title="Email Details & Audit Trail"
      subtitle={email?.recipientEmail || 'Inspecting email record'}
      width="lg"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Fetching email details...</p>
        </div>
      ) : isError ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <p className="font-semibold mb-1">Failed to load email record</p>
          <p className="text-xs">{(error as any)?.message || 'Record not found'}</p>
        </div>
      ) : email ? (
        <div className="space-y-6">
          {/* Status & Quick Stats Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">CURRENT STATUS</span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  getEmailStatusStyles(email.status).badge
                }`}
              >
                {getEmailStatusStyles(email.status).label}
              </span>
            </div>

            {email.retryCount !== undefined && email.retryCount > 0 && (
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 block mb-1">RETRY COUNT</span>
                <Badge variant="warning">{email.retryCount} attempt(s)</Badge>
              </div>
            )}
          </div>

          {/* Delivery Error Callout (if failed or delivery unknown) */}
          {(email.status === 'FAILED' || email.status === 'DELIVERY_UNKNOWN' || email.errorCode) && (
            <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 space-y-1.5">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>DELIVERY FAILURE DETAILS</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Code:</span>
                <span className="font-mono bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded font-bold">
                  {email.errorCode || 'UNKNOWN'}
                </span>
              </div>
              {email.errorMessage && (
                <p className="text-xs text-rose-900 leading-relaxed font-mono break-all pt-1">
                  {email.errorMessage}
                </p>
              )}
            </div>
          )}

          {/* Metadata Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 text-xs">
            <div className="flex items-start justify-between">
              <span className="text-slate-500 font-medium">To:</span>
              <span className="font-semibold text-slate-900 font-mono">{email.recipientEmail}</span>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-slate-500 font-medium">Subject:</span>
              <span className="font-semibold text-slate-900 text-right max-w-[260px] truncate">
                {email.subject}
              </span>
            </div>

            {email.senderAccount && (
              <div className="flex items-start justify-between">
                <span className="text-slate-500 font-medium">Sender:</span>
                <span className="text-slate-700">{email.senderAccount.email}</span>
              </div>
            )}

            {email.scheduledAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Scheduled Time:
                </span>
                <span className="font-mono text-slate-700">{formatDate(email.scheduledAt)}</span>
              </div>
            )}

            {email.sentAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Delivered At:
                </span>
                <span className="font-mono text-emerald-700 font-medium">{formatDate(email.sentAt)}</span>
              </div>
            )}

            {email.providerMessageId && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Provider Message ID:</span>
                <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]">
                  {email.providerMessageId}
                </span>
              </div>
            )}
          </div>

          {/* Email Body preview */}
          {email.body && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Message Content
              </h4>
              <div className="p-4 rounded-xl border border-slate-200 bg-white font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {email.body}
              </div>
            </div>
          )}

          {/* Audit Event History */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span>Lifecycle Audit Trail</span>
              <span className="text-[10px] text-slate-400 font-normal">({email.events?.length || 0} events)</span>
            </h4>
            <EventTimeline events={email.events} />
          </div>
        </div>
      ) : null}
    </Drawer>
  );
};
