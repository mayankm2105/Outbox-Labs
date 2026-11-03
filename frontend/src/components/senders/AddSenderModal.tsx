import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useSenders } from '../../hooks/useSenders';
import { isValidEmail } from '../../utils/validation.util';

export interface AddSenderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddSenderModal: React.FC<AddSenderModalProps> = ({ isOpen, onClose }) => {
  const { createSender, isCreating } = useSenders();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.ethereal.email');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email || !isValidEmail(email)) newErrors.email = 'Please provide a valid sender email';
    if (!smtpHost.trim()) newErrors.smtpHost = 'SMTP host is required';
    if (!smtpPort || smtpPort <= 0) newErrors.smtpPort = 'Valid SMTP port required';
    if (!smtpUsername.trim()) newErrors.smtpUsername = 'SMTP username is required';
    if (!smtpPassword.trim()) newErrors.smtpPassword = 'SMTP password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await createSender({
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort),
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword.trim(),
      });

      // Clear sensitive password from memory immediately
      setSmtpPassword('');
      setEmail('');
      setDisplayName('');
      setSmtpUsername('');
      setErrors({});
      onClose();
    } catch {
      // toast is already fired by mutation
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure SMTP Sender Account" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Sender Email Address"
          placeholder="e.g. notifications@mycompany.com"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
          }}
          error={errors.email}
          required
        />

        <Input
          label="Display Name (Optional)"
          placeholder="e.g. ReachInbox Notifications"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="SMTP Host"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              error={errors.smtpHost}
              required
            />
          </div>
          <div>
            <Input
              label="Port"
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value))}
              error={errors.smtpPort}
              required
            />
          </div>
        </div>

        <Input
          label="SMTP Username"
          placeholder="e.g. user@ethereal.email"
          value={smtpUsername}
          onChange={(e) => setSmtpUsername(e.target.value)}
          error={errors.smtpUsername}
          required
        />

        <Input
          label="SMTP Password"
          placeholder="••••••••••••"
          type="password"
          autoComplete="new-password"
          value={smtpPassword}
          onChange={(e) => setSmtpPassword(e.target.value)}
          error={errors.smtpPassword}
          required
        />

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed">
          <strong>Security Note:</strong> Passwords are encrypted with AES-256-GCM before database storage and are never returned in API payloads.
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isCreating}>
            Save Sender Account
          </Button>
        </div>
      </form>
    </Modal>
  );
};

