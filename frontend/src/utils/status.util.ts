import { EmailStatus, CampaignStatus } from '../types/api';

export function getEmailStatusStyles(status: EmailStatus): { badge: string; label: string } {
  switch (status) {
    case 'SENT':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        label: 'Sent',
      };
    case 'SCHEDULED':
      return {
        badge: 'bg-blue-50 text-blue-700 border border-blue-200',
        label: 'Scheduled',
      };
    case 'PROCESSING':
      return {
        badge: 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse',
        label: 'Processing',
      };
    case 'RETRY_SCHEDULED':
      return {
        badge: 'bg-orange-50 text-orange-700 border border-orange-200',
        label: 'Retry Scheduled',
      };
    case 'FAILED':
      return {
        badge: 'bg-rose-50 text-rose-700 border border-rose-200',
        label: 'Failed',
      };
    case 'CANCELLED':
      return {
        badge: 'bg-slate-100 text-slate-700 border border-slate-200',
        label: 'Cancelled',
      };
    case 'DELIVERY_UNKNOWN':
      return {
        badge: 'bg-purple-50 text-purple-700 border border-purple-200',
        label: 'Delivery Unknown',
      };
    case 'CREATED':
    default:
      return {
        badge: 'bg-slate-100 text-slate-600 border border-slate-200',
        label: 'Created',
      };
  }
}

export function getCampaignStatusStyles(status: CampaignStatus): { badge: string; label: string } {
  switch (status) {
    case 'COMPLETED':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        label: 'Completed',
      };
    case 'PROCESSING':
      return {
        badge: 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse',
        label: 'Processing',
      };
    case 'SCHEDULED':
      return {
        badge: 'bg-blue-50 text-blue-700 border border-blue-200',
        label: 'Scheduled',
      };
    case 'PARTIALLY_COMPLETED':
      return {
        badge: 'bg-amber-50 text-amber-700 border border-amber-200',
        label: 'Partially Completed',
      };
    case 'FAILED':
      return {
        badge: 'bg-rose-50 text-rose-700 border border-rose-200',
        label: 'Failed',
      };
    case 'CANCELLED':
      return {
        badge: 'bg-slate-100 text-slate-700 border border-slate-200',
        label: 'Cancelled',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-600 border border-slate-200',
        label: status,
      };
  }
}

