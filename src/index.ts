import { loadConfig } from "./config.js";
import { ClockEngine } from "./core/clock.js";
import { WellnessTracker } from "./core/habits.js";
import { renderWellnessCard } from "./ui/card.js";

/**
 * Native Gentle-Pi Extension Entry Point
 */
export default function activate(pi: any) {
  // 1. Load user custom config or defaults safely
  const config = loadConfig();
  if (config.enabled === false) {
    return;
  }

  const clockEngine = new ClockEngine(config.clock);
  const tracker = new WellnessTracker(config.habits, config.schedule);

  // 2. Register widget on the Right Sidebar of Gentle-Pi
  pi.on("session_start", async (_event: any, ctx: any) => {
    // Graceful fallback: do nothing if headless or running in non-UI mode
    if (!ctx?.hasUI || typeof ctx.ui?.setWidget !== "function") {
      return;
    }

    try {
      ctx.ui.setWidget("wellness", (_tui: any, theme: any) => {
        return {
          render: (width: number) => {
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
              return true;
            }
            return false;
          },
          digest: () => true,
          dispose: () => {
            // Cleanup hooks
          }
        };
      });
    } catch (err) {
      // Isolate error so it never crashes Gentle-Pi host
      console.error("[wellness-reloj] Error registrando widget:", err);
    }
  });

  // 3. Register user terminal command /wellness
  if (typeof pi.registerCommand === "function") {
    pi.registerCommand("wellness", {
      description: "Gestiona temporizadores de salud y reloj (reset, water, eyes, stretch)",
      handler: async (args: string[], ctx: any) => {
        const subcmd = (args[0] || "").toLowerCase();

        switch (subcmd) {
          case "reset":
            tracker.resetAll();
            ctx.ui?.notify?.("✨ Todos los temporizadores han sido reiniciados.");
            break;
          case "water":
            tracker.resetTimer("water");
            ctx.ui?.notify?.("💧 Temporizador de agua reiniciado.");
            break;
          case "eyes":
            tracker.resetTimer("eyes");
            ctx.ui?.notify?.("👁 Temporizador de descanso visual reiniciado.");
            break;
          case "stretch":
          case "pausa":
            tracker.resetTimer("stretch");
            ctx.ui?.notify?.("🧘 Temporizador de pausa activa reiniciado.");
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
