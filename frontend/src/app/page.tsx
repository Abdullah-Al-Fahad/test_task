'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Plus, Shield, User, Server, Sun, Moon } from 'lucide-react';
import { useStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchRequests, createRequest, login, cancelRequest } from '@/lib/api';
import RequestCard from '@/components/RequestCard';

export default function Home() {
  const { requests, role, token, setAuth, setRequests, upsertRequest } = useStore();
  
  const [customerAccount, setCustomerAccount] = useState('');
  const [requestType, setRequestType] = useState('LINE_DIAGNOSTIC');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  // Auth Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      const res = await login(username, password);
      // Determine role based on username for now (in production, backend should return it)
      const userRole = username.includes('supervisor') ? 'SUPERVISOR' : 'OPERATOR';
      setAuth({ token: res.access, username, role: userRole });
    } catch (err) {
      setAuthError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = customerAccount.trim();
    if (!trimmed) {
      setFormError('Please enter a customer account ID or customer name.');
      return;
    }
    if (trimmed.length < 3) {
      setFormError('Customer Account/Name must be at least 3 characters (e.g. ACC-849 or John Doe).');
      return;
    }
    if (!token) return;
    
    setLoading(true);
    try {
      const newReq = await createRequest(token, { customer_account: trimmed, request_type: requestType });
      upsertRequest(newReq);
      setCustomerAccount('');
      setFormError(null);
      // If active filter would hide the newly created request, reset filter so user sees it immediately
      if (filterType !== 'ALL' && filterType !== requestType) {
        setFilterType('ALL');
      }
      if (filterStatus !== 'ALL' && filterStatus !== 'PENDING') {
        setFilterStatus('ALL');
      }
    } catch(err: any) {
      console.error('Submit error:', err);
      const errMsg = err?.message || '';
      if (errMsg.includes('3 characters')) {
        setFormError('Validation error: Customer account/name must be at least 3 characters.');
      } else {
        setFormError('Failed to dispatch request. Please follow format (e.g. ACC-849 or Customer Name).');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!token) return;
    try {
      await cancelRequest(token, id);
      // We can optimistically set status to CANCELLED or rely on websocket
    } catch(err) {
      console.error('Cancel error:', err);
      alert('Failed to cancel request. It might be too late.');
    }
  };

  // ─── Filter Logic ──────────────────────────────────────────────────────────
  const filteredRequests = requests.filter(req => {
    if (searchQuery && !req.customer_account.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
    if (filterType !== 'ALL' && req.request_type !== filterType) return false;
    return true;
  });

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
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">NexusFiber</h1>
            <p className="text-zinc-500 dark:text-gray-400 mb-8 text-sm">Sign in to the ISP Diagnostic Portal.</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  required
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-md transition-all text-sm font-medium flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
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
                  NexusFiber
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
                {role === 'OPERATOR' ? 'Submit network operations and diagnostic tasks.' : 'Monitoring ISP backend operations in real-time.'}
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
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Customer Account / Name
                          </label>
                          <input
                            type="text"
                            value={customerAccount}
                            onChange={(e) => {
                              setCustomerAccount(e.target.value);
                              if (formError) setFormError(null);
                            }}
                            placeholder="e.g. ACC-849 or Customer Name"
                            className={`w-full bg-white dark:bg-[#0A0A0A] border ${
                              formError || (customerAccount.length > 0 && customerAccount.trim().length < 3)
                                ? 'border-amber-500 focus:ring-amber-500/30'
                                : 'border-zinc-200 dark:border-white/10 focus:ring-zinc-400 dark:focus:ring-white/20'
                            } rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600`}
                            required
                            disabled={loading}
                          />
                          {customerAccount.length > 0 && customerAccount.trim().length < 3 && (
                            <p className="text-[11px] text-amber-500 dark:text-amber-400 mt-1 flex items-center gap-1">
                              ⚠️ Minimum 3 characters required (e.g. ACC-101 or John Doe)
                            </p>
                          )}
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                            Format: Account ID (e.g. ACC-849) or Customer Name
                          </p>
                        </div>

                        {formError && (
                          <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs flex items-start gap-2">
                            <span className="font-bold">⚠️</span>
                            <span>{formError}</span>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Diagnostic Operation
                          </label>
                          <select
                            value={requestType}
                            onChange={(e) => setRequestType(e.target.value)}
                            className="w-full bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all"
                            disabled={loading}
                          >
                            <option value="LINE_DIAGNOSTIC">Line Diagnostic Test</option>
                            <option value="FIRMWARE_UPGRADE">Remote Firmware Upgrade</option>
                            <option value="NETWORK_PROVISION">Network Provisioning</option>
                          </select>
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
                
                {/* Filters */}
                <div className="mb-6 flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Search account..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#111111] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/20 transition-all"
                  >
                    <option value="ALL">All Types</option>
                    <option value="LINE_DIAGNOSTIC">Line Diagnostic Test</option>
                    <option value="FIRMWARE_UPGRADE">Remote Firmware Upgrade</option>
                    <option value="NETWORK_PROVISION">Network Provisioning</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredRequests.map((req) => (
                      <RequestCard key={req.id} request={req} onCancel={handleCancel} />
                    ))}
                  </AnimatePresence>
                  
                  {filteredRequests.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-white/10 rounded-lg bg-zinc-50 dark:bg-[#111111]/50">
                      <Activity className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                      <p className="text-zinc-500 text-sm">No requests found matching your filters.</p>
                      {(searchQuery || filterStatus !== 'ALL' || filterType !== 'ALL') && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setFilterStatus('ALL');
                            setFilterType('ALL');
                          }}
                          className="mt-3 text-xs text-blue-500 dark:text-blue-400 hover:underline font-medium"
                        >
                          Clear filters & search query
                        </button>
                      )}
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
