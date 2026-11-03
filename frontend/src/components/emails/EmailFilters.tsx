import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../common/Input';

export interface EmailFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  startDate?: string;
  onStartDateChange?: (value: string) => void;
  endDate?: string;
  onEndDateChange?: (value: string) => void;
  showDateFilters?: boolean;
}

export const EmailFilters: React.FC<EmailFiltersProps> = ({
  search,
  onSearchChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  showDateFilters = false,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-slate-200 bg-white">
      {/* Search Input */}
      <div className="flex-1 max-w-sm">
        <Input
          placeholder="Search by recipient or subject..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          className="text-xs"
        />
      </div>

      {/* Date filters (Sent tab) */}
      {showDateFilters && onStartDateChange && onEndDateChange && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium shrink-0">Filter:</span>
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          />
        </div>
      )}
    </div>
  );
};

