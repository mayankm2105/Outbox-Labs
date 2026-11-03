import React from 'react';
import { useBackendHealth } from '../../hooks/useBackendHealth';

export const BackendHealthPill: React.FC = () => {
  const { data, isLoading, isError } = useBackendHealth();

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
        Connecting...
      </span>
    );
  }

  if (isError || !data || data.status !== 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        Backend Offline
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      API Online
    </span>
  );
};
