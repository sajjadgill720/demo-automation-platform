import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  id: string;
  label: string;
  detail?: string;
}

export function ProgressTimeline({
  steps,
  currentIndex,
  orientation = "vertical",
}: {
  steps: TimelineStep[];
  currentIndex: number;
  orientation?: "vertical" | "horizontal";
}) {
  if (orientation === "horizontal") {
    return (
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={step.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1",
                  done && "bg-success text-success-foreground ring-success",
                  active && "bg-primary text-primary-foreground ring-primary",
                  !done && !active && "bg-muted text-muted-foreground ring-border",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("h-px flex-1", done ? "bg-success" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <ol className="relative space-y-4">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-1 transition-colors",
                  done && "bg-success text-success-foreground ring-success",
                  active && "bg-primary text-primary-foreground ring-primary",
                  !done && !active && "bg-card text-muted-foreground ring-border",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn("mt-1 w-px flex-1", done ? "bg-success" : "bg-border")}
                  style={{ minHeight: 24 }}
                />
              )}
            </div>
            <div className="pb-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  active || done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              {step.detail && <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
