import { useNavigate } from "@tanstack/react-router";
import {
  HelpCircle,
  Sparkles,
  MousePointerClick,
  Mic,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * Help menu — replaces the decorative "?" button that did nothing.
 *
 * Deliberately concise and honest: a one-line description of how the pipeline
 * actually works, plus quick links to the real pages and a couple of genuine
 * UI tips (clickable rows, agent deletion) that aren't obvious at a glance.
 */
export function HelpMenu() {
  const navigate = useNavigate();

  const tips: {
    icon: React.ComponentType<{ className?: string }>;
    text: string;
  }[] = [
    { icon: MousePointerClick, text: "Click any lead row to see its full details, profile and feedback." },
    { icon: Mic, text: "Agent Tester lists provisioned agents — test the voice or delete one." },
    { icon: MessageSquare, text: "Feedback shows what clients said about their demo." },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Help"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            How it works
          </span>
        </div>

        <div className="px-3 py-3">
          <p className="text-sm leading-relaxed text-foreground/85">
            A lead fills the form → we qualify it → an AI voice agent is provisioned → the client
            tries it on their demo page and leaves feedback.
          </p>
        </div>

        <ul className="border-t px-3 py-2">
          {tips.map((t) => (
            <li key={t.text} className="flex items-start gap-2.5 py-1.5">
              <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs leading-relaxed text-muted-foreground">{t.text}</span>
            </li>
          ))}
        </ul>

        <div className="border-t p-2">
          <button
            onClick={() => navigate({ to: "/build-demo" })}
            className="flex w-full items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" /> Create a new demo
          </button>
          <button
            onClick={() => navigate({ to: "/demo-preview" })}
            className="mt-1.5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View a demo as the client sees it
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
