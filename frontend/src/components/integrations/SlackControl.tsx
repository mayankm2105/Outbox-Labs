import React, { useState } from 'react';
import { MessageSquare, Send, Unlink } from 'lucide-react';
import { useSlack } from '../../hooks/useSlack';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const SlackControl: React.FC = () => {
  const { slackStatus, isLoading, sendTestNotification, isTesting, disconnect, isDisconnecting } =
    useSlack();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (isLoading) return null;

  const isConnected = slackStatus?.connected;

  const handleConnect = () => {
    // Full page navigation to OAuth endpoint
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
    window.location.href = `${backendUrl}/api/v1/integrations/slack/connect`;
  };

  const handleDisconnect = async () => {
    await disconnect();
    setIsConfirmOpen(false);
  };

  if (!isConnected) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleConnect}
        leftIcon={<MessageSquare className="w-3.5 h-3.5 text-slate-500" />}
        className="text-xs"
      >
        Connect Slack
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="font-medium text-slate-700 max-w-[120px] truncate">
          {slackStatus.workspaceName || 'Slack'}
        </span>

        <button
          onClick={() => sendTestNotification()}
          disabled={isTesting}
          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-white transition"
          title="Send test notification"
        >
          <Send className="w-3 h-3" />
        </button>

        <button
          onClick={() => setIsConfirmOpen(true)}
          disabled={isDisconnecting}
          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white transition"
          title="Disconnect Slack"
        >
          <Unlink className="w-3 h-3" />
        </button>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Slack"
        message="Are you sure you want to disconnect Slack? Rate limit notifications will no longer be sent to your workspace."
        confirmLabel="Disconnect"
        isLoading={isDisconnecting}
      />
    </>
  );
};

