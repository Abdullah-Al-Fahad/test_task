'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : 'ws://localhost:8000');
const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Custom hook that manages a persistent, auto-reconnecting WebSocket
 * connection with exponential backoff.
 *
 * Authentication: the JWT token is passed as a query parameter so the
 * Django Channels consumer can validate it before accepting the connection.
 *
 * Only connects when a valid token is present.
 */
export function useWebSocket() {
  const { token, upsertRequest } = useStore();
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/ws/requests/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.info('[WS] Connected');
      retryCountRef.current = 0; // Reset backoff on successful connect
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update' && data.data?.id) {
          upsertRequest(data.data);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      console.warn(`[WS] Closed (code=${event.code}). Reconnecting...`);
      // Code 4001 = auth failure — do not retry
      if (event.code === 4001) {
        console.error('[WS] Authentication failed. Will not reconnect.');
        return;
      }
      const delay = Math.min(
        RECONNECT_BASE_DELAY * 2 ** retryCountRef.current,
        MAX_RECONNECT_DELAY
      );
      retryCountRef.current += 1;
      retryTimeoutRef.current = setTimeout(() => {
        connectRef.current();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror — reconnect logic handled there
      ws.close();
    };
  }, [token, upsertRequest]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
