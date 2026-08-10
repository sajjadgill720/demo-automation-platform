import { Outlet, createFileRoute } from "@tanstack/react-router";
import { JourneyHeader } from "@/components/common/JourneyHeader";
import { ParticleField } from "@/components/common/ParticleField";

/**
 * Pathless layout route for the demo-request wizard.
 *
 * The leading underscore means this segment does NOT appear in the URL — the
 * child screens keep their existing paths (/build-demo, /upload, ...), so no
 * links, redirects or backend callbacks need updating. Mirrors the existing
 * _app.tsx layout pattern.
 *
 * Its only job is to mount JourneyHeader exactly once above <Outlet />, so the
 * progress indicator persists across every step and derives its state from the
 * router instead of from a per-screen prop.
 */
export const Route = createFileRoute("/_wizard")({
  component: WizardLayout,
});

function WizardLayout() {
  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      {/* Ambient background — mirrors the landing page so the wizard feels like
          the same product. Purely decorative: absolutely positioned, behind all
          content, and non-interactive. ParticleField respects reduced-motion. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Masked dot grid, fading toward the bottom */}
        <div
          className="absolute inset-0 opacity-[0.07] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--border) 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 55% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
        {/* Floating ambient glows */}
        <div className="animate-float absolute top-[8%] left-[12%] h-[32rem] w-[32rem] rounded-full bg-primary/[0.05] dark:bg-primary/[0.03] blur-[130px]" />
        <div className="animate-float-delayed absolute bottom-[6%] right-[8%] h-[28rem] w-[28rem] rounded-full bg-primary/[0.04] dark:bg-primary/[0.02] blur-[120px]" />
        {/* Subtle connected particles */}
        <ParticleField
          particleCount={46}
          connectionDistance={110}
          particleColor="rgba(217, 176, 105, 0.22)"
          lineColor="rgba(217, 176, 105, 0.05)"
        />
      </div>

      <JourneyHeader />
      <div className="relative z-10 flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
