import React from 'react';
import { LogOut, Plus, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { BackendHealthPill } from './StatusPill';
import { SlackControl } from '../integrations/SlackControl';
import { Button } from './Button';

export interface NavbarProps {
  onOpenCompose: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCompose }) => {
  const { user, logout, isLoggingOut } = useAuth();

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-8 backdrop-blur-md">
      {/* Brand logo & Health status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-200">
            <Send className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900">ReachInbox</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              Scheduler
            </span>
          </div>
        </div>

        <div className="hidden md:block">
          <BackendHealthPill />
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Slack status & Connect */}
        <div className="hidden sm:block">
          <SlackControl />
        </div>

        {/* Primary Compose Action */}
        <Button
          onClick={onOpenCompose}
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          className="shadow-sm"
        >
          Compose Email
        </Button>

        {/* User profile dropdown / pill */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-2.5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200">
                  {getInitials(user.name, user.email)}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{user.email}</div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

