import React, { useState, useEffect, useMemo } from 'react';
import { Upload, AlertCircle, Clock, Zap, Check } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { useSenders } from '../../hooks/useSenders';
import { useCampaigns } from '../../hooks/useCampaigns';
import { useToast } from '../../context/ToastContext';
import { generateIdempotencyKey } from '../../utils/uuid.util';
import {
  parseRecipients,
  dedupe,
  isStartAtValid,
  MAX_RECIPIENTS,
} from '../../utils/validation.util';
import { parseRecipientsFile } from '../../utils/csv.util';
import { useDebounce } from '../../hooks/useDebounce';

export interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose }) => {
  const { senders, isLoading: isSendersLoading } = useSenders();
  const { scheduleCampaign, isScheduling } = useCampaigns();
  const toast = useToast();

  const [senderAccountId, setSenderAccountId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [uploadedRecipients, setUploadedRecipients] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [startAt, setStartAt] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showInvalidList, setShowInvalidList] = useState(false);

  // Initialize idempotency key and default start time when opening
  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(generateIdempotencyKey());
      // Default to 5 minutes in future in local datetime-local format
      const defaultDate = new Date(Date.now() + 5 * 60 * 1000);
      const localIso = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setStartAt(localIso);
      setFieldErrors({});
    }
  }, [isOpen]);

  // Set default sender if available
  useEffect(() => {
    if (senders.length > 0 && !senderAccountId) {
      const activeSender = senders.find((s) => s.isActive);
      if (activeSender) setSenderAccountId(activeSender.id);
    }
  }, [senders, senderAccountId]);

  // Debounce raw input for responsive live parsing
  const debouncedRecipientsText = useDebounce(recipientsText, 200);

  // Parse combined recipients
  const { uniqueRecipients, invalidRecipients, duplicateCount } = useMemo(() => {
    const fromText = parseRecipients(debouncedRecipientsText);
    const combinedValid = [...fromText.valid, ...uploadedRecipients];
    const { unique, duplicateCount: dupes } = dedupe(combinedValid);

    return {
      uniqueRecipients: unique,
      invalidRecipients: fromText.invalid,
      duplicateCount: dupes,
    };
  }, [debouncedRecipientsText, uploadedRecipients]);

  // Live preview calculations
  const totalCount = uniqueRecipients.length;
  const totalDurationMinutes = totalCount > 1 ? Math.round(((totalCount - 1) * delaySeconds) / 60) : 0;
  const effectiveSendsPerHour = delaySeconds > 0 ? Math.min(hourlyLimit, Math.floor(3600 / delaySeconds)) : hourlyLimit;

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseRecipientsFile(file);
      setUploadedRecipients(parsed.valid);
      setUploadedFileName(file.name);
      if (parsed.invalid.length > 0) {
        toast.warning(`Uploaded file contained ${parsed.invalid.length} invalid email(s) that were filtered.`);
      }
    } catch {
      toast.error('Failed to parse recipient file. Ensure it is a valid CSV or TXT file.');
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!senderAccountId) errors.senderAccountId = 'Please select a sender identity';
    if (!subject.trim()) errors.subject = 'Subject cannot be empty';
    if (!body.trim()) errors.body = 'Email body cannot be empty';
    if (uniqueRecipients.length === 0) errors.recipients = 'Please provide at least one valid recipient';
    if (uniqueRecipients.length > MAX_RECIPIENTS) errors.recipients = `Maximum ${MAX_RECIPIENTS} recipients per campaign`;

    if (!startAt) {
      errors.startAt = 'Start time is required';
    } else {
      const utcIso = new Date(startAt).toISOString();
      if (!isStartAtValid(utcIso)) {
        errors.startAt = 'Start time must be in the future or within the allowed 60-second grace window.';
      }
    }

    if (delaySeconds < 0) errors.delaySeconds = 'Delay must be non-negative';
    if (hourlyLimit <= 0) errors.hourlyLimit = 'Hourly limit must be a positive integer';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      const utcIsoString = new Date(startAt).toISOString();

      const response = await scheduleCampaign({
        payload: {
          senderAccountId,
          subject: subject.trim(),
          body: body.trim(),
          recipients: uniqueRecipients,
          startAt: utcIsoString,
          delaySeconds: Number(delaySeconds),
          hourlyLimit: Number(hourlyLimit),
        },
        idempotencyKey,
      });

      if (response.deduplicatedCount > 0) {
        toast.warning(
          `Notice: ${response.deduplicatedCount} duplicate recipient(s) were automatically merged by the server.`,
          'Duplicates Merged',
        );
      }

      // Reset and close
      setSubject('');
      setBody('');
      setRecipientsText('');
      setUploadedRecipients([]);
      setUploadedFileName(null);
      setIdempotencyKey(generateIdempotencyKey());
      onClose();
    } catch (err: any) {
      if (err.code === 'VALIDATION_ERROR' && err.details) {
        const mappedErrors: Record<string, string> = {};
        for (const d of err.details) {
          if (d.path) mappedErrors[d.path] = d.message;
        }
        setFieldErrors(mappedErrors);
      } else if (err.code === 'START_TIME_IN_PAST') {
        setFieldErrors({
          startAt: 'Start time must be in the future or within the allowed 60-second grace window.',
        });
      } else if (err.code === 'SENDER_NOT_FOUND') {
        toast.error('Selected sender is no longer available — please select another.');
      } else {
        toast.error(err.message || 'Something went wrong scheduling this campaign.');
      }
    }
  };

  const senderOptions = senders
    .filter((s) => s.isActive)
    .map((s) => ({
      value: s.id,
      label: `${s.displayName || 'Sender'} (${s.email})`,
    }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose New Email Campaign" maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Sender Selection */}
        <div>
          <Select
            label="Sender Account"
            value={senderAccountId}
            onChange={(e) => setSenderAccountId(e.target.value)}
            options={[
              { value: '', label: isSendersLoading ? 'Loading senders...' : 'Select sender identity' },
              ...senderOptions,
            ]}
            error={fieldErrors.senderAccountId}
            required
          />
          {senderOptions.length === 0 && !isSendersLoading && (
            <p className="mt-1 text-xs text-amber-600">
              No active senders found. Please add a sender under the Sender Accounts page.
            </p>
          )}
        </div>

        {/* Subject */}
        <Input
          label="Email Subject"
          placeholder="e.g. Product Launch Update & Feedback"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            if (fieldErrors.subject) setFieldErrors((prev) => ({ ...prev, subject: '' }));
          }}
          error={fieldErrors.subject}
          required
        />

        {/* Recipients input + upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Recipients <span className="text-rose-500">*</span>
            </label>
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadedFileName ? 'Change file' : 'Upload CSV / TXT'}</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <Textarea
            placeholder="Enter email addresses separated by commas, spaces, or new lines..."
            rows={3}
            value={recipientsText}
            onChange={(e) => {
              setRecipientsText(e.target.value);
              if (fieldErrors.recipients) setFieldErrors((prev) => ({ ...prev, recipients: '' }));
            }}
            error={fieldErrors.recipients}
          />

          {/* Uploaded file badge */}
          {uploadedFileName && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-slate-600 font-medium truncate">
                File: <span className="text-slate-900">{uploadedFileName}</span> ({uploadedRecipients.length} valid)
              </span>
              <button
                type="button"
                onClick={() => {
                  setUploadedRecipients([]);
                  setUploadedFileName(null);
                }}
                className="text-slate-400 hover:text-rose-600 transition"
              >
                Remove
              </button>
            </div>
          )}

          {/* Recipient breakdown pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
              <Check className="w-3 h-3" />
              {uniqueRecipients.length} unique recipient{uniqueRecipients.length !== 1 ? 's' : ''} detected
            </span>

            {duplicateCount > 0 && (
              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                {duplicateCount} duplicate(s) will be merged
              </span>
            )}

            {invalidRecipients.length > 0 && (
              <button
                type="button"
                onClick={() => setShowInvalidList(!showInvalidList)}
                className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md hover:bg-rose-100 transition"
              >
                <AlertCircle className="w-3 h-3" />
                {invalidRecipients.length} invalid format (ignored)
              </button>
            )}
          </div>

          {showInvalidList && invalidRecipients.length > 0 && (
            <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200 text-xs text-rose-800 max-h-24 overflow-y-auto">
              <p className="font-semibold mb-1">Invalid addresses excluded:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {invalidRecipients.map((inv, idx) => (
                  <li key={idx} className="font-mono">{inv}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Email Body */}
        <Textarea
          label="Email Body"
          placeholder="Write your email content here (supports plaintext and linebreaks)..."
          rows={5}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (fieldErrors.body) setFieldErrors((prev) => ({ ...prev, body: '' }));
          }}
          error={fieldErrors.body}
          required
        />

        {/* Scheduling Constraints: StartAt, Delay, Hourly Limit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <Input
              type="datetime-local"
              label="Start Time"
              value={startAt}
              onChange={(e) => {
                setStartAt(e.target.value);
                if (fieldErrors.startAt) setFieldErrors((prev) => ({ ...prev, startAt: '' }));
              }}
              error={fieldErrors.startAt}
              required
            />
          </div>

          <div>
            <Input
              type="number"
              min={0}
              max={3600}
              label="Delay (seconds)"
              helperText="Wait time between individual emails"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              error={fieldErrors.delaySeconds}
              required
            />
          </div>

          <div>
            <Input
              type="number"
              min={1}
              max={10000}
              label="Hourly Limit"
              helperText="Max emails dispatched per hour"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              error={fieldErrors.hourlyLimit}
              required
            />
          </div>
        </div>

        {/* Reactive Live Preview Panel */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            <span>
              <strong>{uniqueRecipients.length}</strong> recipient(s)
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              ~<strong>{totalDurationMinutes}</strong> min send duration
            </span>
          </div>
          <div className="text-right">
            Speed: ~<strong>{effectiveSendsPerHour}</strong>/hr (limit: {hourlyLimit})
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isScheduling}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isScheduling}
            disabled={uniqueRecipients.length === 0 || !senderAccountId}
          >
            Schedule Campaign
          </Button>
        </div>
      </form>
    </Modal>
  );
};

