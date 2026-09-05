'use client';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Clock, Activity } from 'lucide-react';
import type { ServiceRequest, RequestStatus } from '@/store';

// ─── Status config map — single source of truth, eliminates repeated conditionals ──
const STATUS_CONFIG: Record<RequestStatus, {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
  barClass: string;
}> = {
  PENDING: {
    label: 'Pending',
    icon: <Clock className="w-4 h-4 text-amber-500" />,
    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    barClass: 'bg-amber-500',
  },
  PROCESSING: {
    label: 'Processing',
    icon: <Activity className="w-4 h-4 text-blue-500 animate-pulse" />,
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    barClass: 'bg-blue-500',
  },
  COMPLETED: {
    label: 'Completed',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    barClass: 'bg-emerald-500',
  },
  FAILED: {
    label: 'Failed',
    icon: <AlertCircle className="w-4 h-4 text-rose-500" />,
    badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    barClass: 'bg-rose-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: <AlertCircle className="w-4 h-4 text-zinc-500" />,
    badgeClass: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    barClass: 'bg-zinc-500',
  },
};

interface RequestCardProps {
  request: ServiceRequest;
  onCancel?: (id: string) => void;
}

const formatRequestType = (type: string) => {
  return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
};

export default function RequestCard({ request, onCancel }: RequestCardProps) {
  const config = STATUS_CONFIG[request.status];
  const canCancel = request.status === 'PENDING' || request.status === 'PROCESSING';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col bg-zinc-50 dark:bg-[#111111] border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 rounded-md p-4 transition-colors"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between w-full">
        {/* Left: title + description */}
        <div className="flex-1 min-w-0 mb-4 md:mb-0">
          <div className="flex items-center gap-2 mb-1">
            {config.icon}
            <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate">{formatRequestType(request.request_type)}</h3>
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5 font-mono">
            ACC: {request.customer_account}
          </p>
          {request.operator_username && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1.5 font-medium tracking-wide">
              ASSIGNED TO: {request.operator_username.toUpperCase()}
            </p>
          )}
        </div>

        {/* Right: progress bar + badge */}
        <div className="flex items-center gap-6 shrink-0 min-w-[280px]">
          <div className="flex-1">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-zinc-500 font-medium tracking-widest">PROGRESS</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">{request.progress}%</span>
            </div>
            <div className="h-1 w-full bg-zinc-200 dark:bg-[#1A1A1A] rounded-none overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${request.progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full ${config.barClass}`}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium border ${config.badgeClass}`}
            >
              {config.label}
            </span>
            {canCancel && onCancel && (
              <button
                onClick={() => onCancel(request.id)}
                className="text-[10px] text-rose-500 hover:text-rose-600 font-medium px-2 py-1 uppercase tracking-wider transition-colors bg-rose-500/10 hover:bg-rose-500/20 rounded"
              >
                Cancel Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Terminal Logs */}
      {request.logs && request.logs.length > 0 && (
        <div className="mt-4 bg-zinc-900 dark:bg-black rounded border border-zinc-800 p-3 max-h-32 overflow-y-auto font-mono text-[11px] leading-relaxed shadow-inner">
          {request.logs.map((log, i) => {
            const isError = log.includes('[ERROR]') || log.includes('[WARN]');
            const isSuccess = log.includes('[SUCCESS]');
            let textColor = 'text-zinc-400';
            if (isError) textColor = 'text-rose-400';
            if (isSuccess) textColor = 'text-emerald-400';
            
            return (
              <div key={i} className={`whitespace-pre-wrap ${textColor}`}>
                <span className="text-zinc-600 mr-2">{'>'}</span>{log}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
