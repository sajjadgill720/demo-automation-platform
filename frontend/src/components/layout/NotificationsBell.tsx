import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, AlertTriangle, ThumbsDown, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { listLeads, listAllFeedback } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Real notifications, derived from live data — replaces the decorative bell that
 * always showed a static dot and did nothing.
 *
 * Attention items are the two things an operator actually needs to react to:
 *   - a demo whose agent provisioning FAILED, and
 *   - a client who left NEGATIVE ("needs tweaks") feedback.
 *
 * The dot reflects genuinely-unseen items: we remember the newest item timestamp
 * the operator has already opened (localStorage), so the dot clears on view and
 * only returns when something newer arrives — rather than lighting up forever
 * just because a failure exists somewhere in history.
 */

interface NotifItem {
  id: string;
  kind: "failed" | "feedback";
  title: string;
  detail: string;
  at: string; // ISO
  to: "/active-demos" | "/feedback";
}

const SEEN_KEY = "dq_notifs_seen_at";

export function NotificationsBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [seenAt, setSeenAt] = useState<number>(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSeenAt(Number(localStorage.getItem(SEEN_KEY) || 0));
    }
  }, []);

  const load = async () => {
    try {
      const [leads, feedback] = await Promise.all([
        listLeads({ limit: 200 }).catch(() => []),
        listAllFeedback({ limit: 100 }).catch(() => []),
      ]);

      const failed: NotifItem[] = leads
        .filter((l) => l.agent_status === "failed")
        .map((l) => ({
          id: `failed-${l.id}`,
          kind: "failed",
          title: `Provisioning failed — ${l.company_name}`,
          detail: l.failure_reason || "The agent could not be created.",
          at: l.updated_at,
          to: "/active-demos",
        }));

      const negative: NotifItem[] = feedback
        .filter((f) => f.rating === "negative")
        .map((f) => ({
          id: `fb-${f.id}`,
          kind: "feedback",
          title: `Needs tweaks — ${f.company_name}`,
          detail: f.comment || "Client marked the demo as needing changes.",
          at: f.created_at,
          to: "/feedback",
        }));

      setItems(
        [...failed, ...negative].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 12),
      );
    } catch {
      /* Non-fatal: an empty bell is fine if the backend is unreachable. */
    }
  };

  useEffect(() => {
    load();
    // Light polling so failures/feedback surface without a manual refresh.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const unseen = useMemo(
    () => items.filter((i) => +new Date(i.at) > seenAt).length,
    [items, seenAt],
  );

  const markSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    if (typeof window !== "undefined") localStorage.setItem(SEEN_KEY, String(now));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) markSeen();
      }}
    >
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${unseen ? ` (${unseen} new)` : ""}`}
          className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unseen > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notifications
          </span>
          <span className="text-[10px] text-muted-foreground">{items.length} needing action</span>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
            <Check className="h-5 w-5 text-success" />
            <p className="text-sm text-muted-foreground">All clear — nothing needs attention.</p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: it.to });
                  }}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 cursor-pointer"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      it.kind === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {it.kind === "failed" ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-tight">{it.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {it.detail}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {timeAgo(it.at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
