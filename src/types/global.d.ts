import type { SQTSAPI } from '../../electron/preload';

declare global {
  interface Window {
    sqts: SQTSAPI;
  }
}

export {};
