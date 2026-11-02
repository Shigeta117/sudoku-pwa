/**
 * Full-screen flashes stay well under WCAG 2.3.1's limit of 3 per second (photosensitive
 * seizures): at most 2. Every flash goes through this gate; one asked for too soon is dropped.
 */
export const MIN_FLASH_INTERVAL_MS = 500;

export function createFlashGate(now: () => number = () => performance.now()) {
  let last = -Infinity;
  return function allowFlash(): boolean {
    const t = now();
    if (t - last < MIN_FLASH_INTERVAL_MS) return false;
    last = t;
    return true;
  };
}
