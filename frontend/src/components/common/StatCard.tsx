import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  delta,
  trend,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon: LucideIcon;
  accent?: "primary" | "secondary" | "success" | "warning";
}) {
  const accentBg = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
  }[accent];

  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accentBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {delta && (
        <p className={cn("mt-3 text-xs font-medium", trendColor)}>
          {delta} <span className="text-muted-foreground font-normal">vs last week</span>
        </p>
      )}
    </div>
  );
}
