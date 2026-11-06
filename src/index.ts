import { loadConfig, WellnessConfig } from "./config.js";
import { ClockEngine } from "./core/clock.js";
import { WellnessTracker } from "./core/habits.js";
import { renderWellnessCard } from "./ui/card.js";
import { registerWellnessCommunityModule } from "./wilox-community.js";
import { mountSidebarSlot, createZeroChatWidget, inspectSidebarChain } from "./sidebar-dock.js";

/**
 * Native Gentle-Pi and Gentle-Shell Extension Entry Point
 */
export default function activate(pi: any) {
  // 1. Load user custom config or defaults safely
  let config: WellnessConfig = loadConfig();
  let clockEngine = new ClockEngine(config.clock);
  let tracker = new WellnessTracker(config.habits, config.schedule);

  let activeCtx: any = null;
  let activeTui: any = null;
  let activeTheme: any = null;

  const triggerRender = () => {
    try {
      if (typeof activeTui?.requestRender === "function") {
        activeTui.requestRender();
      } else if (typeof activeCtx?.ui?.requestRender === "function") {
        activeCtx.ui.requestRender();
      }
    } catch {}
  };

  // 2. Register into WiloxDev Modular Accordion Global Bus (/gentle:customize)
  try {
    registerWellnessCommunityModule(
      () => config,
      {
        onConfigChanged: (newConfig: WellnessConfig) => {
          config = newConfig;
          clockEngine = new ClockEngine(config.clock);
          tracker.waterIntervalMs = (config.habits?.waterMinutes ?? 45) * 60 * 1000;
          tracker.eyeRestIntervalMs = (config.habits?.eyeRestMinutes ?? 20) * 60 * 1000;
          tracker.stretchIntervalMs = (config.habits?.stretchMinutes ?? 60) * 60 * 1000;
          if (config.schedule) {
            tracker.schedule = { ...tracker.schedule, ...config.schedule };
          }
          triggerRender();
        },
        onResetHabits: () => {
          tracker.resetAll();
          if (activeCtx?.ui?.notify) {
            activeCtx.ui.notify("✨ Hábitos de bienestar reiniciados.");
          }
          triggerRender();
        },
        requestRender: triggerRender
      }
    );
  } catch (err) {
    console.error("[wellness-reloj] Error registrando módulo comunitario:", err);
  }

  // 3. Mount in Gentle-Shell Right Sidebar and Main TUI lifecycle
  pi.on("session_start", async (_event: any, ctx: any) => {
    activeCtx = ctx;

    // Graceful fallback: do nothing if headless or running in non-UI mode
    if (!ctx?.hasUI || typeof ctx.ui?.setWidget !== "function") {
      return;
    }

    try {
      ctx.ui.setWidget(
        "wellness",
        createZeroChatWidget((tui: any, theme: any) => {
          activeTui = tui;
          activeTheme = theme;

          // A. Mount in Gentle-Shell Right Sidebar Rail via WiloxDev Slots Bus
          try {
            mountSidebarSlot(tui, {
              id: "wellness-reloj",
              title: "🍅 PomoReloj Bigote",
              order: () => config.appearance?.sidebarPriority ?? 25,
              enabled: () => config.enabled !== false,
              render: (width: number) => {
                if (config.enabled === false) return [];
                return renderWellnessCard({
                  width,
                  clockEngine,
                  tracker,
                  config,
                  theme: activeTheme || theme,
                });
              },
              digest: () => {
                const now = Date.now();
                const status = tracker.getStatus(now);
                return `${config.enabled}-${status.water.remainingMins}-${status.eyes.remainingMins}-${status.stretch.remainingMins}-${config.appearance?.layout}-${config.appearance?.sidebarPriority}`;
              },
              handleMouse: (evt: any) => {
                if (evt?.type === "click" && config.habits?.resetOnClick) {
                  tracker.resetAll();
                  ctx.ui?.notify?.("💧 Hábitos de bienestar reiniciados");
                  triggerRender();
                  return { handled: true };
                }
                return undefined;
              },
            });
          } catch (err) {
            console.error("[wellness-reloj] Error acoplando al sidebar rail:", err);
          }
        })
      );
    } catch (err) {
      // Isolate error so it never crashes Gentle-Pi host
      console.error("[wellness-reloj] Error registrando widget:", err);
    }
  });

  // 4. Register user terminal commands (/pomoreloj, /pomo, /wellness)
  if (typeof pi.registerCommand === "function") {
    const handleCommand = async (args: string[], ctx: any) => {
      const subcmd = (args[0] || "").toLowerCase();

      switch (subcmd) {
        case "reset":
          tracker.resetAll();
          ctx.ui?.notify?.("✨ Todos los temporizadores de PomoReloj han sido reiniciados.");
          triggerRender();
          break;
        case "water":
          tracker.resetTimer("water");
          ctx.ui?.notify?.("💧 Temporizador de agua reiniciado.");
          triggerRender();
          break;
        case "eyes":
          tracker.resetTimer("eyes");
          ctx.ui?.notify?.("👁 Temporizador de descanso visual reiniciado.");
          triggerRender();
          break;
        case "sidebar": {
          // Diagnóstico de solo lectura: cadena real de composición del rail.
          const chain = inspectSidebarChain(activeTui);
          const layers = chain.layers.map((l, i) => `${i}:${l.marker}${l.delegates ? "↓" : "(fin)"}`).join(" ") || "ninguna";
          const msg =
            `[PomoReloj Sidebar] compositores=${chain.compositors} profundidad=${chain.depth} ` +
            `ranuras=[${chain.slots.join(",")}] pintados=${chain.stats.renders} digests=${chain.stats.digests} ` +
            `frames-con-doble-pintado=${chain.stats.doubleRenderFrames} | ${layers}` +
            (chain.ok ? "" : ` | aviso: ${chain.reason}`);
          ctx.ui?.notify?.(msg);
          break;
        }
        case "doctor": {
          const now = Date.now();
          const s = tracker.getStatus(now);
          const msg = "[PomoReloj Doctor] Estado: Activo | Agua: " + s.water.remainingMins + "m | Ojos: " + s.eyes.remainingMins + "m | Pausa: " + s.stretch.remainingMins + "m | Config: ~/.config/wiloxdev/settings.json";
          ctx.ui?.notify?.(msg);
          break;
        }
        case "stretch":
        case "pausa":
          tracker.resetTimer("stretch");
          ctx.ui?.notify?.("🧘 Temporizador de pausa activa reiniciado.");
          triggerRender();
          break;
        default:
          ctx.ui?.notify?.(
            "Uso: /pomoreloj [reset | water | eyes | stretch | doctor | sidebar]"
          );
          break;
      }
    };

    const cmdDesc = "🍅 PomoReloj Bigote: temporizadores de salud y reloj (reset, water, eyes, stretch, doctor, sidebar)";
    pi.registerCommand("pomoreloj", { description: cmdDesc, handler: handleCommand });
    pi.registerCommand("pomo", { description: cmdDesc + " (alias rápido)", handler: handleCommand });
    pi.registerCommand("wellness", { description: cmdDesc + " (compatibilidad heredada)", handler: handleCommand });
  }
}
