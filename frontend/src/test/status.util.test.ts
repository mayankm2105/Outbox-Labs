import { describe, it, expect } from 'vitest';
import { getEmailStatusStyles, getCampaignStatusStyles } from '../utils/status.util';
import { EmailStatus, CampaignStatus } from '../types/api';

describe('status.util', () => {
  const allEmailStatuses: EmailStatus[] = [
    'CREATED',
    'SCHEDULED',
    'PROCESSING',
    'RETRY_SCHEDULED',
    'SENT',
    'DELIVERY_UNKNOWN',
    'FAILED',
    'CANCELLED',
  ];

  const allCampaignStatuses: CampaignStatus[] = [
    'SCHEDULED',
    'PROCESSING',
    'COMPLETED',
    'PARTIALLY_COMPLETED',
    'FAILED',
    'CANCELLED',
  ];

  it('maps every EmailStatus without undefined', () => {
    for (const status of allEmailStatuses) {
      const style = getEmailStatusStyles(status);
      expect(style).toBeDefined();
      expect(style.label).toBeTruthy();
      expect(style.badge).toBeTruthy();
    }
  });

  it('maps every CampaignStatus without undefined', () => {
    for (const status of allCampaignStatuses) {
      const style = getCampaignStatusStyles(status);
      expect(style).toBeDefined();
      expect(style.label).toBeTruthy();
      expect(style.badge).toBeTruthy();
    }
  });
});

