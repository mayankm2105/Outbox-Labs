import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { SenderList } from '../components/senders/SenderList';
import { AddSenderModal } from '../components/senders/AddSenderModal';
import { Button } from '../components/common/Button';

export const SendersPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sender Accounts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure SMTP sender identities and Ethereal test credentials for scheduled delivery.
          </p>
        </div>
        <div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Configure Sender
          </Button>
        </div>
      </div>

      {/* Senders Grid */}
      <SenderList onOpenAddSender={() => setIsAddModalOpen(true)} />

      {/* Add Sender Modal */}
      <AddSenderModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};

