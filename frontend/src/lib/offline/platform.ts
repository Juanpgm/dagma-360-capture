// Detección de plataforma y entorno para PWA / offline en DAGMA 360.
// Se ejecuta solo en el navegador (no en SW).

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPad moderno reporta MacIntel + touch
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS: navigator.standalone; Android/desktop: media query
  const iosStandalone = (window.navigator as any).standalone === true;
  const mqStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || mqStandalone;
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detecta heurísticamente si Safari está en modo privado.
 * En modo privado, la cuota de storage es muy baja (típicamente < 120 MB)
 * o IndexedDB falla al escribir.
 */
export async function isLikelyPrivateMode(): Promise<boolean> {
  if (!isSafari() && !isIOS()) return false;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { quota } = await navigator.storage.estimate();
      // Safari normal: cientos de MB a varios GB. Privado: ~120 MB o menos.
      if (typeof quota === 'number' && quota < 120 * 1024 * 1024) return true;
    }
    // Test de escritura: en privado a veces da QuotaExceededError inmediato
    const testKey = '__dagma_private_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return false;
  } catch {
    return true;
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }
  try {
    const already = await navigator.storage.persisted();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageUsageRatio(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota || !usage) return 0;
    return usage / quota;
  } catch {
    return null;
  }
}

export function supportsBackgroundSync(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'SyncManager' in window
  );
}
