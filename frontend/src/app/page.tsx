'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Plus, Shield, User, Server, Sun, Moon, Radio, Terminal, Cpu, ArrowRight, Lock, Check } from 'lucide-react';
import { useStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchRequests, createRequest, login, cancelRequest, register } from '@/lib/api';
import RequestCard from '@/components/RequestCard';

export default function Home() {
  const { requests, role, token, setAuth, setRequests, upsertRequest } = useStore();
  
  const [customerAccount, setCustomerAccount] = useState('');
  const [requestType, setRequestType] = useState('LINE_DIAGNOSTIC');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [signupRole, setSignupRole] = useState<'OPERATOR' | 'SUPERVISOR'>('OPERATOR');
  const [loginRolePreview, setLoginRolePreview] = useState<'OPERATOR' | 'SUPERVISOR'>('OPERATOR');
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      if (authMode === 'LOGIN') {
        const res = await login(username, password);
        setAuth({ token: res.access, username: res.username || username, role: res.role });
      } else {
        const res = await register(username, password, signupRole);
        setAuth({ token: res.access, username: res.username, role: res.role });
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setAuthError(
        authMode === 'LOGIN'
          ? 'Invalid username or password.'
          : 'Failed to create account. Username may already exist (password must be at least 6 characters).'
      );
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
          key="auth"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen bg-zinc-100 dark:bg-[#080808] flex items-center justify-center p-3 sm:p-6 lg:p-10"
        >
          <div className="w-full max-w-5xl bg-white dark:bg-[#0f0f11] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
            
            {/* ─── LEFT PANEL: Platform Showcase & Telemetry Hero ─── */}
            <div className="lg:col-span-5 p-8 lg:p-10 bg-zinc-950 text-white flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-zinc-800/80">
              {/* Radial glow effects */}
              <div className="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                {/* Brand & System Status */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white to-zinc-200 flex items-center justify-center shadow-lg shadow-white/10">
                      <Activity className="w-5 h-5 text-zinc-950" />
                    </div>
                    <div>
                      <span className="font-bold text-lg tracking-tight text-white block leading-tight">NexusFiber</span>
                      <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase">NOC Telemetry v2.4</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE NOC
                  </div>
                </div>

                {/* Platform Mission Statement */}
                <div className="space-y-3 mb-8">
                  <h2 className="text-xl font-semibold tracking-tight text-white leading-snug">
                    Real-Time ISP Diagnostic & Telemetry Orchestration
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    A mission-critical network operations platform built for sub-second telemetry streaming, distributed asynchronous job dispatching, and strict role-based execution governance.
                  </p>
                </div>

                {/* Core Architectural Pillars */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                    <Radio className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Sub-Second WebSocket Feed</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Live terminal stdout/stderr execution progress streamed via Django Channels ASGI channel layers.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                    <Cpu className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Distributed Async Celery Pipeline</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Multi-worker queue processing with on-demand process revocation (<code className="text-[10px] text-zinc-300">SIGKILL</code>) for instant task cancellation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                    <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Strict RBAC & Queue Scoping</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Field operators manage designated subscriber lines, while supervisors monitor global network health and failure rates.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Panel Footer */}
              <div className="relative z-10 mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>PostgreSQL 15 • Redis 7</span>
                <span>Daphne ASGI</span>
              </div>
            </div>

            {/* ─── RIGHT PANEL: Authentication Hub (Sign In / Register) ─── */}
            <div className="lg:col-span-7 p-8 lg:p-10 flex flex-col justify-between bg-white dark:bg-[#0f0f11] text-zinc-900 dark:text-white">
              
              <div>
                {/* Top Nav: Mode Switcher & Theme Toggle */}
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
                        authMode === 'LOGIN'
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('SIGNUP'); setAuthError(''); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide uppercase transition-all ${
                        authMode === 'SIGNUP'
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      Register
                    </button>
                  </div>

                  {/* Dark Mode Toggle */}
                  <button
                    onClick={() => setIsDark(!isDark)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    aria-label="Toggle theme"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                </div>

                {/* Form Title & Context */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                    {authMode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {authMode === 'LOGIN'
                      ? 'Sign in to access your diagnostic dispatch terminal.'
                      : 'Register a new operator or supervisor to test multi-user isolation.'}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUsername(val);
                          if (val.toLowerCase().includes('supervisor')) {
                            setLoginRolePreview('SUPERVISOR');
                          } else if (val.toLowerCase().includes('operator')) {
                            setLoginRolePreview('OPERATOR');
                          }
                        }}
                        placeholder={authMode === 'LOGIN' ? 'e.g. operator1 or supervisor1' : 'Choose a unique username'}
                        className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* ─── REGISTER MODE: Interactive Role Selector + Dynamic Explanations ─── */}
                  {authMode === 'SIGNUP' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                          Select Account Role
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Operator Option Card */}
                          <button
                            type="button"
                            onClick={() => setSignupRole('OPERATOR')}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                              signupRole === 'OPERATOR'
                                ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-500 ring-1 ring-sky-500'
                                : 'bg-zinc-50/70 dark:bg-white/[0.02] border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <Terminal className={`w-4 h-4 ${signupRole === 'OPERATOR' ? 'text-sky-500' : 'text-zinc-400'}`} />
                                <span className="font-semibold text-xs text-zinc-900 dark:text-white">Operator</span>
                              </div>
                              {signupRole === 'OPERATOR' && (
                                <span className="w-2 h-2 rounded-full bg-sky-500" />
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Field diagnostics, test execution & cancellation
                            </p>
                          </button>

                          {/* Supervisor Option Card */}
                          <button
                            type="button"
                            onClick={() => setSignupRole('SUPERVISOR')}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                              signupRole === 'SUPERVISOR'
                                ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-500 ring-1 ring-purple-500'
                                : 'bg-zinc-50/70 dark:bg-white/[0.02] border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <Shield className={`w-4 h-4 ${signupRole === 'SUPERVISOR' ? 'text-purple-500' : 'text-zinc-400'}`} />
                                <span className="font-semibold text-xs text-zinc-900 dark:text-white">Supervisor</span>
                              </div>
                              {signupRole === 'SUPERVISOR' && (
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Global queue oversight & system health metrics
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* ─── DYNAMIC ROLE SPECIFICATION CARD ─── */}
                      <AnimatePresence mode="wait">
                        {signupRole === 'OPERATOR' ? (
                          <motion.div
                            key="operator-desc"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-800/40 text-left"
                          >
                            <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 font-semibold text-xs mb-1.5">
                              <Terminal className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              <span>What the Operator Role Does:</span>
                            </div>
                            <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1 pl-1">
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                                <span><strong>Dispatch Tasks:</strong> Initiate Line Diagnostics, Firmware Upgrades, and ONT Provisioning.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                                <span><strong>Live Terminal:</strong> Streams stdout/stderr telemetry logs in real-time.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                                <span><strong>Cancel Tasks:</strong> Abort active Celery tasks on-demand before completion.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                                <span><strong>Scoped Visibility:</strong> Sees only tasks dispatched by their own account.</span>
                              </li>
                            </ul>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="supervisor-desc"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/25 border border-purple-200/80 dark:border-purple-800/40 text-left"
                          >
                            <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-semibold text-xs mb-1.5">
                              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>What the Supervisor Role Does:</span>
                            </div>
                            <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1 pl-1">
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                                <span><strong>Global Oversight:</strong> Full real-time visibility across all field operators&apos; queues.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                                <span><strong>Inspect Telemetry:</strong> Monitor live stdout/stderr streams across all active dispatches.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                                <span><strong>System Health:</strong> Track network failure rates, completed jobs, and queue load.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                                <span><strong>Separation of Duties:</strong> Read-only governance mode (cannot create dispatches).</span>
                              </li>
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 rounded-lg transition-all text-sm font-semibold flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {loading ? (
                      'Authenticating...'
                    ) : authMode === 'LOGIN' ? (
                      <>
                        <span>Sign In to Terminal</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Register as {signupRole === 'OPERATOR' ? 'Operator' : 'Supervisor'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Error Banner */}
                {authError && (
                  <div className="mt-4 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3 rounded-lg text-left">
                    {authError}
                  </div>
                )}

                {/* ─── QUICK DEMO ACCESS & ROLE EXPLANATION (Sign In Mode) ─── */}
                {authMode === 'LOGIN' && (
                  <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        ⚡ Quick Demo Access & Role Preview
                      </span>
                      <span className="text-[10px] text-zinc-400">1-click switch & auto-fill</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setUsername('operator1');
                          setPassword('password123');
                          setLoginRolePreview('OPERATOR');
                          setAuthError('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          loginRolePreview === 'OPERATOR'
                            ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-500 ring-1 ring-sky-500'
                            : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Terminal className={`w-3.5 h-3.5 ${loginRolePreview === 'OPERATOR' ? 'text-sky-500' : 'text-zinc-400'}`} />
                            <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                              ⚡ Operator
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400">operator1</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-1">Field technician view</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUsername('supervisor1');
                          setPassword('password123');
                          setLoginRolePreview('SUPERVISOR');
                          setAuthError('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          loginRolePreview === 'SUPERVISOR'
                            ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-500 ring-1 ring-purple-500'
                            : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Shield className={`w-3.5 h-3.5 ${loginRolePreview === 'SUPERVISOR' ? 'text-purple-500' : 'text-zinc-400'}`} />
                            <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                              ⚡ Supervisor
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400">supervisor1</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-1">Global oversight view</span>
                      </button>
                    </div>

                    {/* Dynamic Role Explanation Card in Login Mode */}
                    <AnimatePresence mode="wait">
                      {loginRolePreview === 'OPERATOR' ? (
                        <motion.div
                          key="login-op-desc"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-800/40 text-left"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 font-semibold text-xs">
                              <Terminal className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              <span>What the Operator Role Does:</span>
                            </div>
                            <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/50 px-1.5 py-0.5 rounded">
                              Active: operator1
                            </span>
                          </div>
                          <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1 pl-1">
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                              <span><strong>Dispatch Diagnostics:</strong> Line Diagnostic, Firmware Upgrade, and ONT Provisioning.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                              <span><strong>Live Terminal:</strong> Streams stdout/stderr telemetry logs in real-time.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                              <span><strong>Cancel Tasks:</strong> Abort active Celery tasks on-demand before completion.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-sky-500 mt-0.5 shrink-0" />
                              <span><strong>Scoped Visibility:</strong> Sees only tasks dispatched by this operator.</span>
                            </li>
                          </ul>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="login-sup-desc"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/25 border border-purple-200/80 dark:border-purple-800/40 text-left"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300 font-semibold text-xs">
                              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>What the Supervisor Role Does:</span>
                            </div>
                            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded">
                              Active: supervisor1
                            </span>
                          </div>
                          <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1 pl-1">
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                              <span><strong>Global Oversight:</strong> Full real-time visibility across all field operators&apos; queues.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                              <span><strong>Inspect Telemetry:</strong> Monitor live stdout/stderr streams across all active dispatches.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                              <span><strong>System Health:</strong> Track network failure rates, completed jobs, and queue load.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <Check className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                              <span><strong>Separation of Duties:</strong> Read-only governance mode (cannot create dispatches).</span>
                            </li>
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Bottom Auth Mode Toggle Link */}
              <div className="pt-6 mt-4 border-t border-zinc-100 dark:border-white/5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {authMode === 'LOGIN' ? (
                  <span>
                    Need to test a new account?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('SIGNUP'); setAuthError(''); }}
                      className="text-zinc-900 dark:text-white font-semibold hover:underline"
                    >
                      Register here
                    </button>
                  </span>
                ) : (
                  <span>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
                      className="text-zinc-900 dark:text-white font-semibold hover:underline"
                    >
                      Sign in here
                    </button>
                  </span>
                )}
              </div>

            </div>
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
