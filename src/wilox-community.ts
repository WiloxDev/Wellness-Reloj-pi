import { WellnessConfig, persistWellnessPatch, loadConfig } from "./config.js";

export const COMMUNITY_REGISTRY_SLOT = Symbol.for("gentle-pi.community.wiloxdev.registry");
export const COMMUNITY_EXPANDED_SLOT = Symbol.for("gentle-pi.community.wiloxdev.expanded");

export interface WiloxCommunityRow {
  id: string;
  label: () => string;
  preview: () => { title: string; sample: string };
  action: (inline?: any) => void | Promise<void>;
}

export interface WiloxCommunityModule {
  id: string;
  title: string;
  order?: number;
  summary: () => string;
  rows: WiloxCommunityRow[];
}

export interface CommunityModuleCallbacks {
  onConfigChanged?: (newConfig: WellnessConfig) => void;
  onResetHabits?: () => void;
  requestRender?: () => void;
}

/**
 * Registers and synchronizes the Wellness & Reloj module inside Gentle Shell / Pi
 * following the WiloxDev Modular Accordion Protocol for /gentle:customize.
 */
export function registerWellnessCommunityModule(
  getConfig: () => WellnessConfig,
  callbacks?: CommunityModuleCallbacks
): void {
  const globalBus = globalThis as typeof globalThis & {
    [COMMUNITY_REGISTRY_SLOT]?: Map<string, WiloxCommunityModule>;
  };

  const registry = (globalBus[COMMUNITY_REGISTRY_SLOT] ??= new Map<string, WiloxCommunityModule>());

  const applyPatchAndNotify = (patch: Partial<WellnessConfig>) => {
    const updated = persistWellnessPatch(patch);
    if (callbacks?.onConfigChanged) {
      callbacks.onConfigChanged(updated);
    }
    if (callbacks?.requestRender) {
      callbacks.requestRender();
    }
  };

  registry.set("wellness-reloj", {
    id: "wellness-reloj",
    title: "Wellness & Reloj",
    order: 35,
    summary: () => {
      const c = getConfig();
      if (!c.enabled) return "Disabled";
      const fmt = c.clock?.format || "12h";
      const water = c.habits?.waterMinutes || 45;
      return `Active · ${fmt} · ${water}m Agua`;
    },
    get rows(): WiloxCommunityRow[] {
      const c = getConfig();

      // 1. Master Switch with Progressive Disclosure
      const masterRow: WiloxCommunityRow = {
        id: "wellness-master-status",
        label: () => `Wellness Widget: [${getConfig().enabled ? "ON" : "OFF"}]`,
        preview: () => {
          const cfg = getConfig();
          return {
            title: "Wellness & Reloj · Master Switch",
            sample: cfg.enabled
              ? "[ON] Widget activo: Reloj digital ASCII y monitor de salud ergonómica en el sidebar."
              : "[OFF] Widget desactivado: Oculta la tarjeta del sidebar y libera espacio en pantalla."
          };
        },
        action: () => {
          const cfg = getConfig();
          applyPatchAndNotify({ enabled: !cfg.enabled });
        }
      };

      // Si el widget está desactivado, contraer y ocultar todas las opciones secundarias
      if (!c.enabled) {
        return [masterRow];
      }

      // 2. Formato Horario (12h vs 24h)
      const clockFormatRow: WiloxCommunityRow = {
        id: "wellness-clock-format",
        label: () => {
          const cfg = getConfig();
          const fmt = cfg.clock?.format || "12h";
          return `Formato Horario: [${fmt}]`;
        },
        preview: () => {
          const cfg = getConfig();
          const fmt = cfg.clock?.format || "12h";
          return {
            title: "Reloj · Formato Horario",
            sample: fmt === "12h"
              ? "[12h] 08:30 p.m. · Visualización convencional con sufijo a.m./p.m."
              : "[24h] 20:30 · Visualización en horario continuo militar de 24 horas."
          };
        },
        action: () => {
          const cfg = getConfig();
          const next = (cfg.clock?.format || "12h") === "12h" ? "24h" : "12h";
          applyPatchAndNotify({ clock: { ...(cfg.clock || {}), format: next } });
        }
      };

      // 3. Estilo Tipográfico ASCII (Rounded vs Square)
      const clockStyleRow: WiloxCommunityRow = {
        id: "wellness-clock-style",
        label: () => {
          const cfg = getConfig();
          const isRounded = (cfg.clock?.asciiStyle || "rounded") === "rounded";
          return `Estilo ASCII: [${isRounded ? "Rounded" : "Square"}]`;
        },
        preview: () => {
          const cfg = getConfig();
          const isRounded = (cfg.clock?.asciiStyle || "rounded") === "rounded";
          return {
            title: "Reloj · Glifos Digitales ASCII",
            sample: isRounded
              ? "╭─╮  │ │  ╭─╮\n╰─┤  · ·  ┌─╯  (Glifos redondeados suaves)\n──╯       ╰──"
              : "┌─┐  │ │  ┌─┐\n└─┤  · ·  ┌─┘  (Glifos rectos clásicos)\n──┘       └──"
          };
        },
        action: () => {
          const cfg = getConfig();
          const next = (cfg.clock?.asciiStyle || "rounded") === "rounded" ? "square" : "rounded";
          applyPatchAndNotify({ clock: { ...(cfg.clock || {}), asciiStyle: next } });
        }
      };

      // 4. Mostrar Fecha en Footer
      const clockDateRow: WiloxCommunityRow = {
        id: "wellness-clock-date",
        label: () => {
          const cfg = getConfig();
          const show = cfg.clock?.showDate !== false;
          return `Mostrar Fecha: [${show ? "ON" : "OFF"}]`;
        },
        preview: () => ({
          title: "Reloj · Fecha Calendario",
          sample: "[ON] Muestra 'Jue, 30 Oct 2026' en el pie de la tarjeta del sidebar."
        }),
        action: () => {
          const cfg = getConfig();
          const next = !(cfg.clock?.showDate !== false);
          applyPatchAndNotify({ clock: { ...(cfg.clock || {}), showDate: next } });
        }
      };

      // 5. Intervalo de Agua
      const waterRow: WiloxCommunityRow = {
        id: "wellness-water-interval",
        label: () => {
          const cfg = getConfig();
          const mins = cfg.habits?.waterMinutes || 45;
          return `Alerta Agua: [${mins}m]`;
        },
        preview: () => {
          const cfg = getConfig();
          const mins = cfg.habits?.waterMinutes || 45;
          return {
            title: "Ergonomía · Hidratación Periódica",
            sample: `💧 Recordatorio cada ${mins} minutos para beber un vaso de agua.\nCiclo disponible: [30m] ➔ [45m] ➔ [60m].`
          };
        },
        action: () => {
          const cfg = getConfig();
          const current = cfg.habits?.waterMinutes || 45;
          const steps = [30, 45, 60];
          const next = steps[(steps.indexOf(current) + 1) % steps.length] || 45;
          applyPatchAndNotify({ habits: { ...(cfg.habits || {}), waterMinutes: next } });
        }
      };

      // 6. Intervalo de Descanso Visual (Regla 20-20-20)
      const eyesRow: WiloxCommunityRow = {
        id: "wellness-eyes-interval",
        label: () => {
          const cfg = getConfig();
          const mins = cfg.habits?.eyeRestMinutes || 20;
          return `Descanso Ojos: [${mins}m]`;
        },
        preview: () => {
          const cfg = getConfig();
          const mins = cfg.habits?.eyeRestMinutes || 20;
          return {
            title: "Ergonomía · Regla 20-20-20 (Salud Visual)",
            sample: `👁 Pausa visual cada ${mins} minutos mirando a 20 pies durante 20 segundos.\nCiclo disponible: [15m] ➔ [20m] ➔ [30m].`
          };
        },
        action: () => {
          const cfg = getConfig();
          const current = cfg.habits?.eyeRestMinutes || 20;
          const steps = [15, 20, 30];
          const next = steps[(steps.indexOf(current) + 1) % steps.length] || 20;
          applyPatchAndNotify({ habits: { ...(cfg.habits || {}), eyeRestMinutes: next } });
        }
      };

      // 7. Intervalo de Pausa Activa / Estiramiento
      const stretchRow: WiloxCommunityRow = {
        id: "wellness-stretch-interval",
        label: () => {
          const cfg = getConfig();
          const mins = cfg.habits?.stretchMinutes || 60;
          return `Pausa Activa: [${mins}m]`;
        },
        preview: () => {
          const cfg = getConfig();
          const mins = cfg.habits?.stretchMinutes || 60;
          return {
            title: "Ergonomía · Pausa Activa y Postura",
            sample: `🧘 Recordatorio cada ${mins} minutos para levantarse y estirar cuello y hombros.\nCiclo disponible: [45m] ➔ [60m] ➔ [90m].`
          };
        },
        action: () => {
          const cfg = getConfig();
          const current = cfg.habits?.stretchMinutes || 60;
          const steps = [45, 60, 90];
          const next = steps[(steps.indexOf(current) + 1) % steps.length] || 60;
          applyPatchAndNotify({ habits: { ...(cfg.habits || {}), stretchMinutes: next } });
        }
      };

      // 8. Layout de la Tarjeta (Auto vs Side-by-side vs Stacked)
      const layoutRow: WiloxCommunityRow = {
        id: "wellness-layout-mode",
        label: () => {
          const cfg = getConfig();
          const l = cfg.appearance?.layout || "auto";
          const display = l === "auto" ? "Auto" : l === "side-by-side" ? "Side-by-side" : "Stacked";
          return `Layout Tarjeta: [${display}]`;
        },
        preview: () => {
          const cfg = getConfig();
          const l = cfg.appearance?.layout || "auto";
          return {
            title: "Visual · Disposición de la Tarjeta",
            sample: l === "auto"
              ? "[Auto] Adapta automáticamente entre lado a lado (ancho >= 32 cols) y apilado."
              : l === "side-by-side"
              ? "[Side-by-side] Reloj a la izquierda y temporizadores a la derecha en 3 filas compactas."
              : "[Stacked] Reloj centrado arriba y temporizadores en bloque vertical inferior."
          };
        },
        action: () => {
          const cfg = getConfig();
          const current = cfg.appearance?.layout || "auto";
          const modes: Array<"auto" | "side-by-side" | "stacked"> = ["auto", "side-by-side", "stacked"];
          const next = modes[(modes.indexOf(current) + 1) % modes.length] || "auto";
          applyPatchAndNotify({ appearance: { ...(cfg.appearance || {}), layout: next } });
        }
      };

      // 9. Posicionamiento Dinámico en el Sidebar Derecho
      const sidebarPosRow: WiloxCommunityRow = {
        id: "wellness-sidebar-position",
        label: () => {
          const cfg = getConfig();
          const p = cfg.appearance?.sidebarPriority ?? 25;
          return `Posición en Sidebar: [${p <= 25 ? "Bajo Status (Arriba)" : "Bajo Cuota (Abajo)"}]`;
        },
        preview: () => {
          const cfg = getConfig();
          const p = cfg.appearance?.sidebarPriority ?? 25;
          const isTop = p <= 25;
          return {
            title: "Sidebar Dock · Secuencia de Tarjetas",
            sample: isTop
              ? "┌── Sidebar Derecho ────────────┐\n│ 1. 󰣇 Status & Proyecto        │\n│ 2. ⏱️ Wellness + Reloj  [AQUÍ] │\n│ 3. ⚡ CPAMC Sentinel (Cuota)   │\n│ 4. 󰄳 TODO List                │\n└───────────────────────────────┘"
              : "┌── Sidebar Derecho ────────────┐\n│ 1. 󰣇 Status & Proyecto        │\n│ 2. ⚡ CPAMC Sentinel (Cuota)   │\n│ 3. ⏱️ Wellness + Reloj  [AQUÍ] │\n│ 4. 󰄳 TODO List                │\n└───────────────────────────────┘"
          };
        },
        action: () => {
          const cfg = getConfig();
          const current = cfg.appearance?.sidebarPriority ?? 25;
          const next = current <= 25 ? 35 : 15;
          applyPatchAndNotify({ appearance: { ...(cfg.appearance || {}), sidebarPriority: next } });
        }
      };

      // 10. Comportamiento en Modo Angosto (<115 columnas)
      const narrowChatRow: WiloxCommunityRow = {
        id: "wellness-narrow-visibility",
        label: () => {
          const cfg = getConfig();
          const show = cfg.appearance?.showInNarrowChat === true;
          return `Modo Angosto (<115c): [${show ? "Visible en Chat" : "Oculto (Chat Limpio)"}]`;
        },
        preview: () => {
          const cfg = getConfig();
          const show = cfg.appearance?.showInNarrowChat === true;
          return {
            title: "Ergonomía · Terminal Angosto",
            sample: show
              ? "[Visible] En pantallas angostas sin sidebar, muestra la tarjeta sobre el editor."
              : "[Oculto] En pantallas angostas, mantiene el chat 100% limpio sin widgets invasivos."
          };
        },
        action: () => {
          const cfg = getConfig();
          const next = !(cfg.appearance?.showInNarrowChat === true);
          applyPatchAndNotify({ appearance: { ...(cfg.appearance || {}), showInNarrowChat: next } });
        }
      };

      // 11. Acción Rápida: Reiniciar Contadores
      const resetRow: WiloxCommunityRow = {
        id: "wellness-reset-timers",
        label: () => "Reiniciar Hábitos: [Reset]",
        preview: () => ({
          title: "Acción Rápida · Reset de Cronómetros",
          sample: "✨ Pulsa Enter para reiniciar a cero los temporizadores de Agua, Ojos y Pausa Activa."
        }),
        action: () => {
          if (callbacks?.onResetHabits) {
            callbacks.onResetHabits();
          }
          if (callbacks?.requestRender) {
            callbacks.requestRender();
          }
        }
      };

      return [
        masterRow,
        clockFormatRow,
        clockStyleRow,
        clockDateRow,
        waterRow,
        eyesRow,
        stretchRow,
        layoutRow,
        sidebarPosRow,
        narrowChatRow,
        resetRow
      ];
    }
  });
}
