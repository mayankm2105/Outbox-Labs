import { describe, it, expect } from 'vitest';
import { EmailStatus, CampaignStatus } from '@prisma/client';
import {
  canTransitionEmailStatus,
  calculateCampaignStatus,
} from '../../src/modules/emails/email-status';

describe('Email Lifecycle Transitions', () => {
  it('allows valid transitions from CREATED', () => {
    expect(canTransitionEmailStatus(EmailStatus.CREATED, EmailStatus.SCHEDULED)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.CREATED, EmailStatus.FAILED)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.CREATED, EmailStatus.SENT)).toBe(false);
  });

  it('allows valid transitions from SCHEDULED', () => {
    expect(canTransitionEmailStatus(EmailStatus.SCHEDULED, EmailStatus.PROCESSING)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.SCHEDULED, EmailStatus.CANCELLED)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.SCHEDULED, EmailStatus.SENT)).toBe(false);
  });

  it('allows valid transitions from PROCESSING including DELIVERY_UNKNOWN', () => {
    expect(canTransitionEmailStatus(EmailStatus.PROCESSING, EmailStatus.SENT)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.PROCESSING, EmailStatus.RETRY_SCHEDULED)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.PROCESSING, EmailStatus.FAILED)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.PROCESSING, EmailStatus.SCHEDULED)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.PROCESSING, EmailStatus.DELIVERY_UNKNOWN)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.PROCESSING, EmailStatus.CANCELLED)).toBe(false);
  });

  it('allows DELIVERY_UNKNOWN to transition only to SENT or FAILED', () => {
    expect(canTransitionEmailStatus(EmailStatus.DELIVERY_UNKNOWN, EmailStatus.SENT)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.DELIVERY_UNKNOWN, EmailStatus.FAILED)).toBe(true);
    expect(canTransitionEmailStatus(EmailStatus.DELIVERY_UNKNOWN, EmailStatus.SCHEDULED)).toBe(false);
  });

  it('prohibits transitions from terminal statuses (SENT, FAILED, CANCELLED)', () => {
    expect(canTransitionEmailStatus(EmailStatus.SENT, EmailStatus.PROCESSING)).toBe(false);
    expect(canTransitionEmailStatus(EmailStatus.FAILED, EmailStatus.SCHEDULED)).toBe(false);
    expect(canTransitionEmailStatus(EmailStatus.CANCELLED, EmailStatus.SCHEDULED)).toBe(false);
  });
});

describe('Campaign Status Calculation', () => {
  it('returns SCHEDULED when all emails are scheduled', () => {
    const statuses = [EmailStatus.SCHEDULED, EmailStatus.SCHEDULED];
    expect(calculateCampaignStatus(statuses)).toBe(CampaignStatus.SCHEDULED);
  });

  it('returns PROCESSING when at least one email is in processing or delivery unknown', () => {
    const statuses = [EmailStatus.SENT, EmailStatus.PROCESSING, EmailStatus.SCHEDULED];
    expect(calculateCampaignStatus(statuses)).toBe(CampaignStatus.PROCESSING);
  });

  it('returns COMPLETED when all emails are SENT', () => {
    const statuses = [EmailStatus.SENT, EmailStatus.SENT];
    expect(calculateCampaignStatus(statuses)).toBe(CampaignStatus.COMPLETED);
  });

  it('returns FAILED when all emails are FAILED', () => {
    const statuses = [EmailStatus.FAILED, EmailStatus.FAILED];
    expect(calculateCampaignStatus(statuses)).toBe(CampaignStatus.FAILED);
  });

  it('returns CANCELLED when all emails are CANCELLED', () => {
    const statuses = [EmailStatus.CANCELLED, EmailStatus.CANCELLED];
    expect(calculateCampaignStatus(statuses)).toBe(CampaignStatus.CANCELLED);
  });

  it('returns PARTIALLY_COMPLETED when mix of sent and failed/cancelled with no pending work', () => {
    const statuses = [EmailStatus.SENT, EmailStatus.FAILED, EmailStatus.CANCELLED];
    expect(calculateCampaignStatus(statuses)).toBe(CampaignStatus.PARTIALLY_COMPLETED);
  });
});

