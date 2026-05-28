/**
 * installPrompt — Detección de capacidad de instalación PWA (bug #1, #6).
 *
 * Expone un store con:
 *   - platform: 'android' | 'ios' | 'desktop' | 'unsupported'
 *   - isInstalled: true si la app corre en modo standalone (ya instalada)
 *   - canInstall: true si podemos disparar instalación nativa (Android/Desktop con prompt diferido)
 *
 * Android/Chrome: capturamos el evento `beforeinstallprompt` para disparar
 * el flujo nativo cuando el usuario lo solicite (no en el load).
 *
 * iOS Safari: NO soporta beforeinstallprompt. La única vía oficial es
 * "Compartir → Agregar a pantalla de inicio"; mostramos instrucciones.
 *
 * Desktop Chrome/Edge: usa beforeinstallprompt igual que Android.
 */
import { writable } from "svelte/store";

export type InstallPlatform = "android" | "ios" | "desktop" | "unsupported";

export interface InstallState {
  platform: InstallPlatform;
  isInstalled: boolean;
  canInstall: boolean;
  /** Solo expuesto internamente: el evento diferido beforeinstallprompt. */
  _deferredPrompt?: any;
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "unsupported";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  // iPadOS 13+ reporta UA de Mac; usamos touch points para distinguir.
  const isIPadOS =
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  if (isIOS || isIPadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  // Chrome/Edge desktop también soportan beforeinstallprompt.
  if (/Chrome|Edg|Chromium/i.test(ua)) return "desktop";
  return "unsupported";
}

function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  // iOS Safari expone esto cuando la app corre desde "Agregar a inicio".
  if ((navigator as any).standalone === true) return true;
  return false;
}

const initial: InstallState = {
  platform: detectPlatform(),
  isInstalled: detectInstalled(),
  canInstall: false,
  _deferredPrompt: undefined,
};

export const installState = writable<InstallState>(initial);

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: any) => {
    // Prevenir el banner automático: queremos disparar manualmente desde Settings.
    event.preventDefault();
    installState.update((s) => ({
      ...s,
      _deferredPrompt: event,
      canInstall: true,
    }));
  });

  window.addEventListener("appinstalled", () => {
    installState.update((s) => ({
      ...s,
      isInstalled: true,
      canInstall: false,
      _deferredPrompt: undefined,
    }));
    try {
      console.info("[INSTALL] appinstalled — DAGMA 360 instalada");
    } catch (_) {}
  });
}

/**
 * Dispara el prompt nativo de instalación (Android/Desktop).
 * Devuelve el outcome reportado por el navegador.
 */
export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  let current: InstallState | undefined;
  installState.subscribe((s) => (current = s))();
  const prompt = current?._deferredPrompt;
  if (!prompt) return "unavailable";
  try {
    prompt.prompt();
    const choice = await prompt.userChoice;
    installState.update((s) => ({
      ...s,
      _deferredPrompt: undefined,
      canInstall: false,
    }));
    return choice?.outcome === "accepted" ? "accepted" : "dismissed";
  } catch (e) {
    console.error("[INSTALL] Error en prompt:", e);
    return "unavailable";
  }
}
