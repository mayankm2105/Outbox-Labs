import { parseRecipients } from './validation.util';

export async function parseRecipientsFile(
  file: File,
): Promise<{ valid: string[]; invalid: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      // Strip CSV quotes if any
      const cleaned = text.replace(/["']/g, '');
      const parsed = parseRecipients(cleaned);
      resolve(parsed);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

