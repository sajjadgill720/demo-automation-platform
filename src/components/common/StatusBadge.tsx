import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted" | "brand";

const toneClass: Record<Tone, string> = {
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/15 text-warning ring-warning/25",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-primary/10 text-primary ring-primary/20",
  brand: "bg-secondary/10 text-secondary ring-secondary/20",
  muted: "bg-muted text-muted-foreground ring-border",
};

export function StatusBadge({
  children,
  tone = "muted",
  className,
  dot = true,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function statusToTone(status: string): Tone {
  switch (status) {
    case "complete":
    case "completed":
    case "live":
    case "ready":
      return "success";
    case "sent":
      return "info";
    case "running":
    case "provisioning":
    case "research":
    case "prompt":
    case "agent":
      return "brand";
    case "failed":
    case "expired":
      return "danger";
    case "queued":
    case "idle":
    case "lead":
      return "muted";
    default:
      return "muted";
  }
}
