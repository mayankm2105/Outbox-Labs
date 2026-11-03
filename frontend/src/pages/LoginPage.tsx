import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ShieldCheck, Clock, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BackendHealthPill } from '../components/common/StatusPill';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
    window.location.href = `${backendUrl}/api/v1/auth/google`;
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50">
      {/* Top micro navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <Send className="h-4 w-4" />
          </div>
          <span className="text-base font-bold text-slate-900">ReachInbox</span>
        </div>
        <BackendHealthPill />
      </header>

      {/* Hero card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-10 space-y-8 animate-in fade-in duration-300">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Send className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              ReachInbox Scheduler
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Enterprise asynchronous email scheduling with sliding-window rate limiting and BullMQ persistence.
            </p>
          </div>

          {/* Value props */}
          <div className="space-y-3 py-2 border-y border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Configurable inter-email delays & persistent BullMQ queue</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Distributed sliding-window hourly rate limit protection</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Transactional outbox & Ethereal SMTP test delivery</span>
            </div>
          </div>

          {/* Google Sign In button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-xs transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {/* Google Icon SVG */}
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400">
        ReachInbox Technical Assessment • Google OAuth 2.0
      </footer>
    </div>
  );
};

