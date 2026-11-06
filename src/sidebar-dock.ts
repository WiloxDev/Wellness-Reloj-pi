export const SIDEBAR_SLOTS_SLOT = Symbol.for("gentle-pi.community.wiloxdev.sidebar-slots");

export interface WiloxSidebarSlot {
  id: string;
  title: string;
  order: () => number;
  enabled: () => boolean;
  render: (width: number) => string[];
  digest?: () => string;
  handleMouse?: (event: any, localY: number) => any;
}

export interface CompositorSlotMeta {
  id: string;
  startY: number;
  height: number;
  slot: WiloxSidebarSlot;
}

/**
 * Contadores puros de un compositor vivo. No cambian el pintado: solo observan.
 *
 * El host evalúa `digest()` una vez por frame (shell-sidebar-layout.ts, issue #1681) y luego
 * pinta cada sección una vez. Si `render()` se invoca más de una vez entre dos `digest()`,
 * hay un paso extra de pintado sobre el mismo rail (medición, doble sección u hoja de panel),
 * que es justo lo que hay que distinguir antes de tocar la composición.
 */
export interface CompositorFrameStats {
  renders: number;
  digests: number;
  rendersThisFrame: number;
  doubleRenderFrames: number;
}

const frameStatsRegistry: CompositorFrameStats[] = [];

/**
 * Estado observable de la cadena de composición del rail, sin efectos secundarios.
 * Devuelve cuántas capas hay por encima del footer, cuáles se declaran como enlaces
 * de delegación (`__originalRail`) y cuántas ranuras están registradas.
 */
export function inspectSidebarChain(tui: any): {
  ok: boolean;
  reason?: string;
  compositors: number;
  layers: Array<{ marker: string; delegates: boolean }>;
  depth: number;
  slots: string[];
  stats: { compositors: number; renders: number; digests: number; doubleRenderFrames: number };
} {
  const bus = globalThis as typeof globalThis & { [SIDEBAR_SLOTS_SLOT]?: Map<string, WiloxSidebarSlot> };
  const slots = Array.from(bus[SIDEBAR_SLOTS_SLOT]?.keys() ?? []);
  const stats = {
    compositors: frameStatsRegistry.length,
    renders: frameStatsRegistry.reduce((n, s) => n + s.renders, 0),
    digests: frameStatsRegistry.reduce((n, s) => n + s.digests, 0),
    doubleRenderFrames: frameStatsRegistry.reduce((n, s) => n + s.doubleRenderFrames, 0),
  };

  const terminal = tui?.terminal as any;
  if (!terminal) return { ok: false, reason: "sin terminal", compositors: 0, layers: [], depth: 0, slots, stats };
  const state =
    terminal[Symbol.for("gentle-pi.experimental-sidebar.state")] ||
    terminal[Symbol.for("wilox-pi.sidebar.state")] ||
    terminal[Symbol.for("j0k3r-theme.sidebar.state")];
  const footer = state?.parts?.get?.("footer");
  if (!footer) return { ok: false, reason: "sin footer en parts", compositors: 0, layers: [], depth: 0, slots, stats };

  const layers: Array<{ marker: string; delegates: boolean }> = [];
  const seen = new Set<any>();
  let node: any = footer;
  let compositors = 0;
  while (node && !seen.has(node)) {
    seen.add(node);
    const marker = node.__isWiloxSlotsCompositor
      ? "wilox-slots-compositor"
      : node.__isCpamcDecorated
        ? "cpamc-decorator"
        : node.__discordAttached
          ? "discord-decorator"
          : node.render
            ? "rail"
            : "capa sin render";
    if (node.__isWiloxSlotsCompositor) compositors += 1;
    layers.push({ marker, delegates: node.__originalRail !== undefined });
    node = node.__originalRail;
  }
  return { ok: true, compositors, layers, depth: layers.length, slots, stats };
}

/**
 * Registra una ranura comunitaria en el Bus Unificado de Sidebar de WiloxDev
 * y envuelve el "footer" (Status card) de Gentle-Shell de forma resiliente y no invasiva.
 */
export function mountSidebarSlot(tui: any, slot: WiloxSidebarSlot): () => void {
  const terminal = tui?.terminal as any;
  if (!terminal) {
    return () => {};
  }

  const GENTLE_STATE_SLOT = Symbol.for("gentle-pi.experimental-sidebar.state");
  const ALT_SIDEBAR_SLOT = Symbol.for("wilox-pi.sidebar.state");
  const J0K3R_SIDEBAR_SLOT = Symbol.for("j0k3r-theme.sidebar.state");

  const gentleState = terminal[GENTLE_STATE_SLOT] || terminal[ALT_SIDEBAR_SLOT] || terminal[J0K3R_SIDEBAR_SLOT];
  if (!gentleState?.parts) {
    return () => {};
  }

  // 1. Registrar slot en el registro global compartido
  const globalBus = globalThis as typeof globalThis & {
    [SIDEBAR_SLOTS_SLOT]?: Map<string, WiloxSidebarSlot>;
  };
  const slotRegistry = (globalBus[SIDEBAR_SLOTS_SLOT] ??= new Map<string, WiloxSidebarSlot>());
  slotRegistry.set(slot.id, slot);

  // 2. Función envolvente de "footer" con soporte para inicialización tardía o rebinds
  //
  // Un compositor de ranuras ya puede estar montado debajo de capas intermedias que
  // otra extensión haya insertado sobre el footer visible. Si solo se inspecciona la
  // capa exterior, cada montador reinstala el compositor y las ranuras compartidas se
  // dibujan duplicadas. Se recorre la cadena de delegación (acotada y segura frente a
  // ciclos) para localizar el compositor real antes de volver a envolver.
  const findSlotsCompositor = (footer: any): boolean => {
    const visited = new Set<any>();
    let layer = footer;
    while (layer && !visited.has(layer)) {
      if (layer.__isWiloxSlotsCompositor) {
        return true;
      }
      visited.add(layer);
      layer = layer.__originalRail;
    }
    return false;
  };

  const wrapFooter = () => {
    const originalRail = gentleState.parts.get("footer");
    if (!originalRail || findSlotsCompositor(originalRail)) {
      return;
    }

    let lastRenderedMeta: CompositorSlotMeta[] = [];
    const frameStats: CompositorFrameStats = { renders: 0, digests: 0, rendersThisFrame: 0, doubleRenderFrames: 0 };
    frameStatsRegistry.push(frameStats);
    const statsIndex = frameStatsRegistry.length - 1;

    const compositorRail = {
      __isWiloxSlotsCompositor: true,
      __originalRail: originalRail,
      surface: "panel",
      render: (width: number) => {
        // Observación pura: cuenta pintados por frame sin alterar la salida.
        frameStats.renders += 1;
        frameStats.rendersThisFrame += 1;
        if (frameStats.rendersThisFrame === 2) frameStats.doubleRenderFrames += 1;

        let baseLines: string[] = [];
        try {
          baseLines = originalRail.render ? (originalRail.render(width) ?? []) : [];
        } catch {
          baseLines = [];
        }

        const lines = [...baseLines];
        lastRenderedMeta = [];

        // Obtener slots activos ordenados por prioridad
        const slots = Array.from(slotRegistry.values())
          .filter((s) => {
            try {
              return s.enabled();
            } catch {
              return false;
            }
          })
          .sort((a, b) => a.order() - b.order());

        for (const s of slots) {
          try {
            const slotLines = s.render(width);
            if (slotLines && slotLines.length > 0) {
              if (lines.length > 0) {
                lines.push(""); // Separador visual entre tarjetas
              }
              const startY = lines.length;
              lines.push(...slotLines);
              lastRenderedMeta.push({
                id: s.id,
                startY,
                height: slotLines.length,
                slot: s
              });
            }
          } catch (err) {
            console.error(`[WiloxDev Sidebar] Error renderizando slot ${s.id}:`, err);
          }
        }

        return lines;
      },
      digest: () => {
        // Un digest marca el inicio de un nuevo frame del rail.
        frameStats.digests += 1;
        frameStats.rendersThisFrame = 0;

        let baseDigest = "";
        try {
          baseDigest = typeof originalRail.digest === "function" ? originalRail.digest() : "";
        } catch {
          baseDigest = "";
        }

        const slotDigests = Array.from(slotRegistry.values())
          .filter((s) => s.enabled())
          .sort((a, b) => a.order() - b.order())
          .map((s) => {
            try {
              return `${s.id}:${s.order()}:${s.digest ? s.digest() : ""}`;
            } catch {
              return `${s.id}:error`;
            }
          })
          .join("::");

        return `${baseDigest}::wilox-slots::${slotDigests}`;
      },
      invalidate: () => {
        try {
          originalRail.invalidate?.();
        } catch {}
      },
      handleMouse: (event: any) => {
        if (!event) return originalRail.handleMouse?.(event);

        const clickY = event.y;
        if (typeof clickY !== "number") {
          return originalRail.handleMouse?.(event);
        }

        // Delegar clic si aterriza dentro del área de algún slot registrado
        for (const meta of lastRenderedMeta) {
          if (clickY >= meta.startY && clickY < meta.startY + meta.height) {
            const localY = clickY - meta.startY;
            if (typeof meta.slot.handleMouse === "function") {
              const handled = meta.slot.handleMouse(event, localY);
              if (handled) {
                return typeof handled === "object" ? handled : { handled: true };
              }
            }
          }
        }

        return originalRail.handleMouse?.(event);
      },
      dispose: () => {
        // El compositor deja de existir: su contador deja de ocupar el agregado.
        if (frameStatsRegistry[statsIndex] === frameStats) frameStatsRegistry.splice(statsIndex, 1);
        // Solo se restaura la capa base original si este compositor sigue siendo el
        // footer activo; si otra extensión lo encapsuló, despojarlo eliminaría su capa.
        if (slotRegistry.size === 0 && gentleState.parts.get("footer") === compositorRail) {
          gentleState.parts.set("footer", originalRail);
        }
      }
    };

    gentleState.parts.set("footer", compositorRail);
  };

  wrapFooter();

  return () => {
    slotRegistry.delete(slot.id);
  };
}

/**
 * Factoría que genera un widget para Pi con INVARIANTE ZERO-CHAT ESTRICTA:
 * Captura las referencias vivas de `tui` y `theme`, pero devuelve `render: () => []`
 * garantizando que NUNCA se inyecte una sola línea ni tarjeta en el stream de chat superior.
 */
export function createZeroChatWidget(onMount?: (tui: any, theme: any) => void) {
  let mounted = false;
  return (tui: any, theme: any) => {
    if (!mounted && onMount) {
      mounted = true;
      try {
        onMount(tui, theme);
      } catch (err) {
        console.error("[ZeroChatWidget] Error en hook de montaje:", err);
      }
    }
    return {
      render: () => [],
      handleMouse: () => undefined,
      digest: () => "zero-chat-invariant",
      invalidate: () => {},
      dispose: () => {}
    };
  };
}
