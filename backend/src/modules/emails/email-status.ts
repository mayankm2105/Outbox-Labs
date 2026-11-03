import { EmailStatus, CampaignStatus } from '@prisma/client';

export const ALLOWED_EMAIL_TRANSITIONS: Record<EmailStatus, EmailStatus[]> = {
  [EmailStatus.CREATED]: [EmailStatus.SCHEDULED, EmailStatus.FAILED],
  [EmailStatus.SCHEDULED]: [EmailStatus.PROCESSING, EmailStatus.CANCELLED],
  [EmailStatus.PROCESSING]: [
    EmailStatus.SENT,
    EmailStatus.RETRY_SCHEDULED,
    EmailStatus.FAILED,
    EmailStatus.SCHEDULED,
    EmailStatus.DELIVERY_UNKNOWN,
  ],
  [EmailStatus.RETRY_SCHEDULED]: [
    EmailStatus.SCHEDULED,
    EmailStatus.PROCESSING,
    EmailStatus.FAILED,
    EmailStatus.CANCELLED,
  ],
  [EmailStatus.DELIVERY_UNKNOWN]: [EmailStatus.SENT, EmailStatus.FAILED],
  [EmailStatus.SENT]: [],
  [EmailStatus.FAILED]: [],
  [EmailStatus.CANCELLED]: [],
};

export function canTransitionEmailStatus(
  currentStatus: EmailStatus,
  targetStatus: EmailStatus,
): boolean {
  const allowed = ALLOWED_EMAIL_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

/**
 * Calculates aggregate CampaignStatus from the list/count of its email statuses.
 */
export function calculateCampaignStatus(statuses: EmailStatus[]): CampaignStatus {
  if (statuses.length === 0) return CampaignStatus.SCHEDULED;

  const total = statuses.length;
  const sentCount = statuses.filter((s) => s === EmailStatus.SENT).length;
  const failedCount = statuses.filter((s) => s === EmailStatus.FAILED).length;
  const cancelledCount = statuses.filter((s) => s === EmailStatus.CANCELLED).length;
  const processingCount = statuses.filter(
    (s) => s === EmailStatus.PROCESSING || s === EmailStatus.DELIVERY_UNKNOWN,
  ).length;

  if (processingCount > 0) {
    return CampaignStatus.PROCESSING;
  }

  if (sentCount === total) {
    return CampaignStatus.COMPLETED;
  }

  if (failedCount === total) {
    return CampaignStatus.FAILED;
  }

  if (cancelledCount === total) {
    return CampaignStatus.CANCELLED;
  }

  // Any completed + failed/cancelled with no pending work
  const pendingCount = statuses.filter(
    (s) => s === EmailStatus.CREATED || s === EmailStatus.SCHEDULED || s === EmailStatus.RETRY_SCHEDULED,
  ).length;

  if (pendingCount === 0) {
    return CampaignStatus.PARTIALLY_COMPLETED;
  }

  if (sentCount > 0) {
    return CampaignStatus.PROCESSING;
  }

  return CampaignStatus.SCHEDULED;
}

