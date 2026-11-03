import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailTable } from '../components/emails/EmailTable';
import * as emailsHook from '../hooks/useEmails';

vi.mock('../hooks/useEmails');
vi.mock('../hooks/useDebounce', () => ({
  useDebounce: (v: unknown) => v,
}));

describe('EmailTable Component', () => {
  const mockOnRowClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when loading', () => {
    vi.spyOn(emailsHook, 'useEmails').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { container } = render(
      <EmailTable variant="scheduled" onRowClick={mockOnRowClick} />,
    );

    // TableSkeleton renders animate-pulse elements
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when items list is empty', () => {
    vi.spyOn(emailsHook, 'useEmails').mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<EmailTable variant="scheduled" onRowClick={mockOnRowClick} />);
    expect(screen.getByText('No scheduled emails')).toBeInTheDocument();
  });

  it('renders populated rows and handles row clicks', () => {
    const mockEmail = {
      id: 'email-123',
      campaignId: 'camp-1',
      recipientEmail: 'alex@example.com',
      scheduledAt: new Date().toISOString(),
      sentAt: null,
      failedAt: null,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
      campaign: {
        subject: 'Weekly Product Roadmap',
      },
    };

    vi.spyOn(emailsHook, 'useEmails').mockReturnValue({
      data: {
        items: [mockEmail],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<EmailTable variant="scheduled" onRowClick={mockOnRowClick} />);

    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('Weekly Product Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();

    const row = screen.getByText('alex@example.com').closest('tr');
    expect(row).toBeInTheDocument();
    if (row) {
      fireEvent.click(row);
      expect(mockOnRowClick).toHaveBeenCalledWith('email-123');
    }
  });

  it('renders error state on API failure', () => {
    vi.spyOn(emailsHook, 'useEmails').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Network connection failed' },
      refetch: vi.fn(),
    } as any);

    render(<EmailTable variant="sent" onRowClick={mockOnRowClick} />);
    expect(screen.getByText('Failed to load emails')).toBeInTheDocument();
    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
  });
});
