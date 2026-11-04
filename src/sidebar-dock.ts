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
 * Registers a community slot into the WiloxDev Unified Sidebar Bus
 * and decorates the Gentle-Shell "footer" (Status card) so cards stack deterministically.
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

  // 1. Register slot in the global bus
  const globalBus = globalThis as typeof globalThis & {
    [SIDEBAR_SLOTS_SLOT]?: Map<string, WiloxSidebarSlot>;
  };
  const slotRegistry = (globalBus[SIDEBAR_SLOTS_SLOT] ??= new Map<string, WiloxSidebarSlot>());
  slotRegistry.set(slot.id, slot);

  // 2. Wrap "footer" (Status Card) if not already wrapped by our compositor
  const originalRail = gentleState.parts.get("footer");
  if (originalRail && !originalRail.__isWiloxSlotsCompositor) {
    let lastRenderedMeta: CompositorSlotMeta[] = [];

    const compositorRail = {
      __isWiloxSlotsCompositor: true,
      __originalRail: originalRail,
      render: (width: number) => {
        let baseLines: string[] = [];
        try {
          baseLines = originalRail.render ? (originalRail.render(width) ?? []) : [];
        } catch {
          baseLines = [];
        }

        const lines = [...baseLines];
        lastRenderedMeta = [];

        // Collect all active community slots and sort by order
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
                lines.push(""); // Clean vertical separator between cards
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

        // Check if click lands inside any registered slot
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
        // If all slots are unregistered, restore original rail
        if (slotRegistry.size === 0) {
          gentleState.parts.set("footer", originalRail);
        }
      }
    };

    gentleState.parts.set("footer", compositorRail);
  }

  return () => {
    slotRegistry.delete(slot.id);
  };
}
