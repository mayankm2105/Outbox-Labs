import { describe, it, expect } from 'vitest';
import { parseRecipientsFile } from '../utils/csv.util';

describe('csv.util', () => {
  it('parses CSV and text content with quotes and line breaks', async () => {
    const csvContent = `"john@example.com","sarah@example.com"\n"bad-email"\nalex@example.com\n\n`;
    const file = new File([csvContent], 'recipients.csv', { type: 'text/csv' });

    const result = await parseRecipientsFile(file);

    expect(result.valid).toEqual([
      'john@example.com',
      'sarah@example.com',
      'alex@example.com',
    ]);
    expect(result.invalid).toEqual(['bad-email']);
  });
});

