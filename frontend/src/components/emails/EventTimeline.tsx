import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EmailEvent } from '../../types/api';
import { formatDate } from '../../utils/date.util';

export interface EventTimelineProps {
  events?: EmailEvent[];
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  if (!events || events.length === 0) {
    return <p className="text-xs text-slate-400 italic">No lifecycle events recorded yet.</p>;
  }

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {events.map((event) => {
        const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
        const isExpanded = expandedNodes[event.id];

        return (
          <div key={event.id} className="relative group">
            {/* Timeline bullet dot */}
            <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white bg-indigo-600 shadow-2xs group-hover:scale-125 transition-transform" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  {event.eventType}
                </span>
                {(event.previousStatus || event.newStatus) && (
                  <span className="ml-2 text-[11px] text-slate-500 font-mono">
                    {event.previousStatus ? `${event.previousStatus} → ` : ''}
                    <span className="font-semibold text-slate-700">{event.newStatus}</span>
                  </span>
                )}
              </div>
              <time className="text-[11px] text-slate-400 shrink-0 font-mono">
                {formatDate(event.createdAt)}
              </time>
            </div>

            {hasMetadata && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => toggleNode(event.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>{isExpanded ? 'Hide details' : 'View event metadata'}</span>
                </button>

                {isExpanded && (
                  <pre className="mt-1 p-2 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-40 leading-relaxed shadow-inner">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

