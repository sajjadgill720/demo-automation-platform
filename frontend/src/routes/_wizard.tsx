import { Outlet, createFileRoute } from "@tanstack/react-router";
import { JourneyHeader } from "@/components/common/JourneyHeader";

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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <JourneyHeader />
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
