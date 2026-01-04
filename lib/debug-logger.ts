/**
 * Debug logger for runtime debugging
 * Works in both dev (localhost) and PWA (localStorage fallback)
 */

const DEBUG_ENDPOINT = 'http://127.0.0.1:7243/ingest/2481bc32-4712-4b5d-b758-9fd81e48ab0e';
const STORAGE_KEY = 'debug_logs';
const MAX_STORED_LOGS = 1000;

interface LogData {
  location: string;
  message: string;
  data?: any;
  timestamp: number;
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
}

export function debugLog(logData: LogData): void {
  // Try to send to localhost endpoint (works in dev)
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logData),
  }).catch(() => {
    // Fallback: Store in localStorage (works in PWA)
    if (typeof localStorage !== 'undefined') {
      try {
        const existingLogs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        existingLogs.push(logData);
        // Keep only last MAX_STORED_LOGS entries
        const trimmedLogs = existingLogs.slice(-MAX_STORED_LOGS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));
      } catch (e) {
        // Silently fail if localStorage is full or unavailable
      }
    }
  });
}

export function getDebugLogs(): LogData[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearDebugLogs(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

