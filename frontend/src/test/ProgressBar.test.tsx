import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressBar } from '../components/common/ProgressBar';

describe('ProgressBar component', () => {
  it('renders neutral empty bar when total is 0 without divide by zero', () => {
    const { container } = render(<ProgressBar total={0} sent={0} failed={0} pending={0} />);
    const bar = container.querySelector('.bg-slate-200');
    expect(bar).toBeInTheDocument();
  });

  it('renders progress bar segments for populated campaign', () => {
    const { container } = render(
      <ProgressBar total={100} sent={50} failed={10} pending={40} showLabels />,
    );

    const sentSeg = container.querySelector('[title="Sent: 50 (50.0%)"]');
    const failedSeg = container.querySelector('[title="Failed: 10 (10.0%)"]');
    const pendingSeg = container.querySelector('[title="Pending: 40 (40.0%)"]');

    expect(sentSeg).toBeInTheDocument();
    expect(failedSeg).toBeInTheDocument();
    expect(pendingSeg).toBeInTheDocument();
  });
});
