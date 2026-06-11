/**
 * R6-13 (R5-03): platform detection for the persistence story. On iOS,
 * navigator.storage.persist() never prompts and almost always returns false —
 * real protection comes from installing the PWA to the home screen.
 */

export function isIosDevice(): boolean {
  const ua = navigator.userAgent;
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as MacIntel with touch support.
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return classicIos || iPadOs;
}

export function isStandaloneDisplayMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}
