import { loadConfig, WellnessConfig } from "./config.js";
import { ClockEngine } from "./core/clock.js";
import { WellnessTracker } from "./core/habits.js";
import { renderWellnessCard } from "./ui/card.js";
import { registerWellnessCommunityModule } from "./wilox-community.js";

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

  // 3. Register widget on the Right Sidebar of Gentle-Pi / Gentle-Shell
  pi.on("session_start", async (_event: any, ctx: any) => {
    activeCtx = ctx;

    // Graceful fallback: do nothing if headless or running in non-UI mode
    if (!ctx?.hasUI || typeof ctx.ui?.setWidget !== "function") {
      return;
    }

    try {
      ctx.ui.setWidget("wellness", (tui: any, theme: any) => {
        activeTui = tui;
        return {
          render: (width: number) => {
            if (config.enabled === false) {
              return [];
            }
            return renderWellnessCard({
              width,
              clockEngine,
              tracker,
              config,
              theme
            });
          },
          handleMouse: (evt: any) => {
            // Click to reset habits if enabled
            if (evt?.type === "click" && config.habits?.resetOnClick) {
              tracker.resetAll();
              ctx.ui?.notify?.("💧 Hábitos de bienestar reiniciados");
              triggerRender();
              return true;
            }
            return false;
          },
          digest: () => true,
          dispose: () => {
            if (activeTui === tui) {
              activeTui = null;
            }
          }
        };
      });
    } catch (err) {
      // Isolate error so it never crashes Gentle-Pi host
      console.error("[wellness-reloj] Error registrando widget:", err);
    }
  });

  // 4. Register user terminal command /wellness
  if (typeof pi.registerCommand === "function") {
    pi.registerCommand("wellness", {
      description: "Gestiona temporizadores de salud y reloj (reset, water, eyes, stretch)",
      handler: async (args: string[], ctx: any) => {
        const subcmd = (args[0] || "").toLowerCase();

        switch (subcmd) {
          case "reset":
            tracker.resetAll();
            ctx.ui?.notify?.("✨ Todos los temporizadores han sido reiniciados.");
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
          case "stretch":
          case "pausa":
            tracker.resetTimer("stretch");
            ctx.ui?.notify?.("🧘 Temporizador de pausa activa reiniciado.");
            triggerRender();
            break;
          default:
            ctx.ui?.notify?.(
              "Uso: /wellness [reset | water | eyes | stretch]"
            );
            break;
        }
      }
    });
  }
}
