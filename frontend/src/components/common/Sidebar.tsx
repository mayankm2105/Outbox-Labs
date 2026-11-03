import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Megaphone, Users, ExternalLink, Activity } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/senders', label: 'Sender Accounts', icon: Users },
  ];

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between py-6 px-4 shrink-0 hidden md:flex">
      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Navigation
          </div>
          <nav className="space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 shadow-3xs font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    )
                  }
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {isAdmin && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              System Admin
            </div>
            <a
              href={`${backendUrl}/admin/queues`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                <span>BullMQ Queues</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        )}
      </div>

      {/* Footer / Info */}
      <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 px-3">
        <p className="font-semibold text-slate-600">ReachInbox v1.0</p>
        <p className="mt-0.5">Asynchronous Queue Architecture</p>
      </div>
    </aside>
  );
};

