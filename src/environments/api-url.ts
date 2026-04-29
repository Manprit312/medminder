import { Capacitor } from '@capacitor/core';
import { environment } from './environment';

/**
 * API base URL. Uses `environment.apiUrl`.
 *
 * - **Browser (`ionic serve`)**: uses configured URL as-is (often localhost → local backend).
 * - **Android emulator + localhost**: `getApiUrl()` rewrites host to `10.0.2.2` so the emulator reaches the host machine.
 * - **Physical device**: `localhost` points at the phone itself — use a public HTTPS URL (default in env) or your PC’s LAN IP for a local backend.
 */
export function getApiUrl(): string {
  const configured = environment.apiUrl;
  if (typeof globalThis === 'undefined' || typeof URL === 'undefined') {
    return configured;
  }
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return configured;
    }
    const u = new URL(configured);
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return configured;
    }
    u.hostname = '10.0.2.2';
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.protocol}//${u.host}${path}${u.search}${u.hash}`;
  } catch {
    return configured;
  }
}
