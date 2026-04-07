import { Capacitor } from '@capacitor/core';
import { environment } from './environment';

/**
 * API base URL for the current runtime. On native Android, rewrites `localhost` /
 * `127.0.0.1` to `10.0.2.2` so a dev server on the host is reachable from the
 * emulator (physical devices still need your LAN IP in `environment`).
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
