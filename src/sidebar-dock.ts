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

    const compositorRail = {
      __isWiloxSlotsCompositor: true,
      __originalRail: originalRail,
      surface: "panel",
      render: (width: number) => {
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
