'use client';
import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { CheckCircle2, AlertCircle, Clock, Activity, Trash2, Check } from 'lucide-react';
import type { ServiceRequest, RequestStatus } from '@/store';

// ─── Status config map — single source of truth ──────────────────────────────
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
  onDelete?: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isSelectionMode?: boolean;
}

const formatRequestType = (type: string) => {
  return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
};

export default function RequestCard({
  request,
  onCancel,
  onDelete,
  isSelected = false,
  onToggleSelect,
  isSelectionMode = false,
}: RequestCardProps) {
  const [userOpened, setUserOpened] = useState(false);
  const x = useMotionValue(0);

  const config = STATUS_CONFIG[request.status];
  const canCancel = request.status === 'PENDING' || request.status === 'PROCESSING';
  const isTerminal = request.status === 'COMPLETED' || request.status === 'FAILED' || request.status === 'CANCELLED';
  const canSwipe = !isSelectionMode && isTerminal && Boolean(onDelete);
  const isOpen = userOpened && canSwipe;

  // Dynamic opacity: 0 at rest (x=0, preventing reload flash!), fades to 1 as you swipe left
  const bgOpacity = useTransform(x, [-5, -45], [0, 1]);
  const trashScale = useTransform(x, [-10, -96], [0.7, 1.05]);

  // Automatically snap back to 0 if selection mode is entered or task becomes non-terminal
  useEffect(() => {
    if (!canSwipe) {
      animate(x, 0, { duration: 0.15 });
    }
  }, [canSwipe, x]);

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(request.id);
    }
  };

  const handleCardClick = () => {
    if (isOpen) {
      animate(x, 0, { type: 'spring', damping: 25, stiffness: 300 });
      setUserOpened(false);
    }
  };

  const toggleSwipe = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      animate(x, 0, { type: 'spring', damping: 25, stiffness: 300 });
      setUserOpened(false);
    } else {
      animate(x, -96, { type: 'spring', damping: 25, stiffness: 300 });
      setUserOpened(true);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="relative overflow-hidden rounded-md"
    >
      {/* Background Swipe-to-Delete Action:
          - bgOpacity is strictly 0 when x=0, so on page reload it NEVER flashes!
          - only becomes visible and active as the card is swiped left */}
      {canSwipe && (
        <motion.div
          style={{ opacity: bgOpacity }}
          className={`absolute inset-y-0 right-0 w-24 bg-rose-600 rounded-r-md flex items-center justify-center z-0 ${
            isOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <motion.button
            type="button"
            style={{ scale: trashScale }}
            onClick={handleConfirmDelete}
            title="Confirm delete"
            className="w-full h-full flex flex-col items-center justify-center text-white gap-1 px-2 hover:bg-rose-700 active:bg-rose-800 transition-colors font-sans select-none"
          >
            <Trash2 className="w-5 h-5 text-white" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Delete</span>
          </motion.button>
        </motion.div>
      )}

      {/* Foreground Swipeable Card:
          - 100% solid, opaque background
          - Draggable along X axis with spring snap physics */}
      <motion.div
        drag={canSwipe ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.12}
        style={{ x }}
        onDragEnd={(e, info) => {
          if (!canSwipe) return;
          if (isOpen) {
            if (info.offset.x > 20 || info.velocity.x > 200) {
              animate(x, 0, { type: 'spring', damping: 25, stiffness: 300 });
              setUserOpened(false);
            } else {
              animate(x, -96, { type: 'spring', damping: 25, stiffness: 300 });
            }
          } else {
            if (info.offset.x < -40 || info.velocity.x < -300) {
              animate(x, -96, { type: 'spring', damping: 25, stiffness: 300 });
              setUserOpened(true);
            } else {
              animate(x, 0, { type: 'spring', damping: 25, stiffness: 300 });
              setUserOpened(false);
            }
          }
        }}
        onClick={handleCardClick}
        className={`group relative z-10 flex flex-col bg-white dark:bg-[#111111] border rounded-md p-4 transition-colors select-none ${
          isSelected && isTerminal
            ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/30'
            : 'border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10'
        } ${canSwipe ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between w-full">
          {/* Left: Checkbox + title + description */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Row selection checkbox (only for finished requests) */}
            {onToggleSelect && isTerminal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(request.id);
                }}
                title="Select finished request for deletion"
                className={`mt-1 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 bg-white dark:bg-zinc-900'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </button>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {config.icon}
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  {formatRequestType(request.request_type)}
                </h3>
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
          </div>

          {/* Right: progress bar + status badge + actions */}
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

            <div className="flex flex-col items-center gap-1.5 shrink-0 min-w-[90px]">
              <span
                className={`w-full inline-flex items-center justify-center px-2.5 py-0.5 rounded-[4px] text-[11px] font-medium border text-center ${config.badgeClass}`}
              >
                {config.label}
              </span>

              {canCancel && onCancel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(request.id);
                  }}
                  className="w-full inline-flex items-center justify-center text-[10px] text-rose-500 hover:text-rose-600 font-medium px-2 py-0.5 uppercase tracking-wider transition-colors bg-rose-500/10 hover:bg-rose-500/20 rounded text-center"
                >
                  Cancel Task
                </button>
              )}
            </div>

            {/* Individual Swipe / Trash Indicator (only for finished requests and not in multi-select) */}
            {canSwipe && (
              <div className="shrink-0 flex items-center justify-center w-8">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.15, rotate: [0, -10, 10, -5, 0] }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleSwipe}
                  title={isOpen ? "Close delete action" : "Swipe left or click to delete"}
                  className={`p-1.5 rounded-md transition-colors ${
                    isOpen
                      ? 'text-rose-500 bg-rose-500/10'
                      : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            )}
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
    </motion.div>
  );
}
