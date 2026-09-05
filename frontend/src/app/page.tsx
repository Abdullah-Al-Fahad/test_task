'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Plus, Shield, User, Server, Sun, Moon } from 'lucide-react';
import { useStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchRequests, createRequest, login } from '@/lib/api';
import RequestCard from '@/components/RequestCard';

export default function Home() {
  const { requests, role, token, setAuth, setRequests, upsertRequest } = useStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Theme state
  const [isDark, setIsDark] = useState(true);

  // Sync theme with HTML class
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // 1. Initialise WebSocket connection (handled by hook)
  useWebSocket();

  // 2. Fetch initial data on mount (or when token changes)
  useEffect(() => {
    if (!token) return;
    fetchRequests(token)
      .then(setRequests)
      .catch((err) => console.error('Failed to fetch requests:', err));
  }, [token, setRequests]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleDemoLogin = async (demoRole: 'OPERATOR' | 'SUPERVISOR') => {
    setLoading(true);
    setAuthError('');
    try {
      // In a real app we'd have a full login form, but for demo purposes
      // we'll auto-login with hardcoded demo users. (Assumes they exist in DB)
      const username = demoRole === 'OPERATOR' ? 'operator1' : 'supervisor1';
      const password = 'password123'; // Demo password
      const res = await login(username, password);
      setAuth({ token: res.access, username, role: demoRole });
    } catch (err) {
      setAuthError(`Failed to login as ${demoRole}. Did you run the Django fixtures/seed script?`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !token) return;
    
    setLoading(true);
    try {
      const newReq = await createRequest(token, { title, description });
      // Upsert into store (insert at top since API returns the new record)
      upsertRequest(newReq);
      setTitle('');
      setDescription('');
    } catch(err) {
      console.error('Submit error:', err);
      alert('Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      {!token ? (
        <motion.div
          key="login"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen bg-white dark:bg-[#0A0A0A] flex flex-col items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-white/10 p-10 rounded-lg shadow-2xl text-center">
            <div className="w-12 h-12 bg-zinc-900 dark:bg-white rounded-md mx-auto flex items-center justify-center mb-6">
              <Activity className="w-6 h-6 text-white dark:text-black" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">NexusFlow</h1>
            <p className="text-zinc-500 dark:text-gray-400 mb-8 text-sm">Select a role to enter the demo environment.</p>
            
            <div className="space-y-3">
              <button
                onClick={() => handleDemoLogin('OPERATOR')}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-[#1A1A1A] hover:bg-zinc-200 dark:hover:bg-[#222222] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 hover:text-zinc-900 dark:hover:text-white rounded-md transition-all text-sm font-medium flex justify-center items-center gap-2 disabled:opacity-50"
              >
                <User className="w-4 h-4" /> Login as Operator
              </button>
              <button
                onClick={() => handleDemoLogin('SUPERVISOR')}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-[#1A1A1A] hover:bg-zinc-200 dark:hover:bg-[#222222] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 hover:text-zinc-900 dark:hover:text-white rounded-md transition-all text-sm font-medium flex justify-center items-center gap-2 disabled:opacity-50"
              >
                <Shield className="w-4 h-4" /> Login as Supervisor
              </button>
            </div>
            {authError && <p className="mt-5 text-sm text-red-500 dark:text-red-400">{authError}</p>}
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.3 }}
          className="min-h-screen bg-white dark:bg-[#0A0A0A] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800 pb-20"
        >
          {/* Navigation */}
          <nav className="border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-sm bg-zinc-900 dark:bg-white flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white dark:text-black" />
                </div>
                <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-white">
                  NexusFlow
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                  aria-label="Toggle theme"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setAuth({ token: null, username: null, role: null })}
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </nav>

          {/* Main */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="mb-10 flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                {role === 'OPERATOR' ? 'Operator Portal' : 'Live Supervisor Dashboard'}
              </h1>
              <p className="text-zinc-500 text-sm">
                {role === 'OPERATOR' ? 'Submit tasks and track your own requests.' : 'Monitoring all system activity in real-time via WebSockets.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form (Only Operator) */}
              <AnimatePresence mode="popLayout">
                {role === 'OPERATOR' && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="lg:col-span-4"
                  >
                    <div className="bg-zinc-50 dark:bg-[#111111] rounded-lg border border-zinc-200 dark:border-white/10 p-5 sticky top-20">
                      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-zinc-200 dark:border-white/5">
                        <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                        <h2 className="text-sm font-medium text-zinc-900 dark:text-white">New Request</h2>
                      </div>
                      
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Request Title"
                            className="w-full bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            required
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description (optional)"
                            className="w-full bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 min-h-[80px] resize-none"
                            disabled={loading}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-zinc-900 text-white dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:text-black font-medium py-2 rounded-md transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Server className="w-4 h-4" />
                          {loading ? 'Deploying...' : 'Deploy Request'}
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* List */}
              <div className={role === 'OPERATOR' ? "lg:col-span-8" : "lg:col-span-12"}>
                <div className="space-y-4">
                  <AnimatePresence>
                    {requests.map((req) => (
                      <RequestCard key={req.id} request={req} />
                    ))}
                  </AnimatePresence>
                  
                  {requests.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-white/10 rounded-lg bg-zinc-50 dark:bg-[#111111]/50">
                      <Activity className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                      <p className="text-zinc-500 text-sm">No requests found in the system.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
