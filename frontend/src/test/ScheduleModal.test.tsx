import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScheduleModal } from '../components/campaigns/ScheduleModal';
import * as sendersHook from '../hooks/useSenders';
import * as campaignsHook from '../hooks/useCampaigns';
import * as toastContext from '../context/ToastContext';

vi.mock('../hooks/useSenders');
vi.mock('../hooks/useCampaigns');
vi.mock('../context/ToastContext');
vi.mock('../hooks/useDebounce', () => ({
  useDebounce: (v: unknown) => v,
}));

describe('ScheduleModal Component', () => {
  const mockScheduleCampaign = vi.fn();
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sendersHook, 'useSenders').mockReturnValue({
      senders: [
        {
          id: 'sender-1',
          name: 'Sales Team',
          email: 'sales@example.com',
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          secure: true,
          isActive: true,
          userId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      createSender: vi.fn(),
      isCreating: false,
    } as any);

    vi.spyOn(campaignsHook, 'useCampaigns').mockReturnValue({
      campaigns: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      scheduleCampaign: mockScheduleCampaign,
      isScheduling: false,
      cancelCampaign: vi.fn(),
      isCancelling: false,
    } as any);

    vi.spyOn(toastContext, 'useToast').mockReturnValue({
      showToast: mockShowToast,
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      removeToast: vi.fn(),
    });
  });

  it('renders correctly when open', () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Compose New Email Campaign' })).toBeInTheDocument();
    expect(screen.getByText(/0 unique recipients detected/i)).toBeInTheDocument();
  });

  it('updates recipient count when emails are typed into the textarea', () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/Enter email addresses separated by/i);

    fireEvent.change(textarea, {
      target: { value: 'user1@example.com, user2@example.com, invalid-email' },
    });

    // Valid recipients count badge
    expect(screen.getByText(/2 unique recipients detected/i)).toBeInTheDocument();
    // Invalid email badge
    expect(screen.getByText(/1 invalid format \(ignored\)/i)).toBeInTheDocument();
  });

  it('detects duplicate emails and displays duplicate indicator', () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/Enter email addresses separated by/i);

    fireEvent.change(textarea, {
      target: { value: 'dup@example.com, dup@example.com' },
    });

    // Valid count is 1
    expect(screen.getByText(/1 unique recipient detected/i)).toBeInTheDocument();
    // Duplicate warning badge should display
    expect(screen.getByText(/1 duplicate\(s\) will be merged/i)).toBeInTheDocument();
  });

  it('shows error when startAt is more than 60s in the past', () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />);
    const submitBtn = screen.getByRole('button', { name: /Schedule Campaign/i });

    const senderSelect = screen.getByLabelText(/Sender Account/i);
    fireEvent.change(senderSelect, { target: { value: 'sender-1' } });

    // Fill in subject
    const subjectInput = screen.getByPlaceholderText(/e.g. Product Launch Update & Feedback/i);
    fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });

    // Fill in body
    const bodyInput = screen.getByPlaceholderText(/Write your email content here/i);
    fireEvent.change(bodyInput, { target: { value: 'Hello world' } });

    // Fill in recipient
    const textarea = screen.getByPlaceholderText(/Enter email addresses separated by/i);
    fireEvent.change(textarea, { target: { value: 'user@example.com' } });

    // Set start time to 2 hours in the past
    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const localIso = new Date(pastDate.getTime() - pastDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    const startAtInput = screen.getByLabelText(/Start Time/i);
    fireEvent.change(startAtInput, { target: { value: localIso } });

    fireEvent.click(submitBtn);

    expect(screen.getByText(/Start time must be in the future or within the allowed 60-second grace window/i)).toBeInTheDocument();
    expect(mockScheduleCampaign).not.toHaveBeenCalled();
  });
});
