import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Sparkles, ArrowRight, Loader2, Flag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  respondToClarification,
  skipRemainingClarification,
  getClarificationStatus,
  NetworkError,
  type ClarificationStatusResponse,
} from "@/lib/api";
import { z } from "zod";

const INPUT_CLS =
  "w-full bg-secondary border border-border px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary/65 font-mono text-xs transition-colors input-glow";

const clarificationSearchSchema = z.object({
  leadId: z.string(),
});

export const Route = createFileRoute("/_wizard/clarification")({
  validateSearch: clarificationSearchSchema,
  component: ClarificationRoute,
});

function ClarificationRoute() {
  const { leadId } = Route.useSearch();
  const navigate = useNavigate();

  const [clarificationStatus, setClarificationStatus] = useState<ClarificationStatusResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentQuestionText, setCurrentQuestionText] = useState("");

  // Which question the user is on. The backend does not expose a total (the number
  // of questions depends on how many profile gaps a given lead has), so this is a
  // running count rather than "3 of 7". Counting DISTINCT assistant messages means
  // a question re-asked after a meta-response is not counted twice; a helpful reply
  // to a meta-response is the one case that can still nudge the count.
  /**
   * Consecutive messages from the same speaker render as ONE bubble.
   *
   * The backend emits several assistant messages per turn — the opening intro
   * followed by the first question, or (on a meta-response) a direct reply
   * followed by the re-asked question. Rendering one bubble per message made a
   * single turn look like two separate messages, so they are grouped here and
   * separated inside the bubble by a hairline instead.
   */
  const messageGroups = useMemo(() => {
    const history = clarificationStatus?.conversation_history ?? [];
    const groups: { role: string; contents: string[] }[] = [];

    for (const m of history) {
      const last = groups[groups.length - 1];
      if (last && last.role === m.role) last.contents.push(m.content);
      else groups.push({ role: m.role, contents: [m.content] });
    }

    // The pending question isn't always persisted into history yet; fold it into
    // the trailing assistant group so it shares the bubble with what preceded it.
    const pending = clarificationStatus?.current_question?.trim();
    if (
      pending &&
      !history.some((m) => m.role === "assistant" && m.content.trim() === pending)
    ) {
      const last = groups[groups.length - 1];
      if (last && last.role === "assistant") last.contents.push(pending);
      else groups.push({ role: "assistant", contents: [pending] });
    }

    return groups;
  }, [clarificationStatus?.conversation_history, clarificationStatus?.current_question]);

  const questionNumber = new Set(
    (clarificationStatus?.conversation_history ?? [])
      .filter((m) => m.role === "assistant")
      .map((m) => m.content.trim()),
  ).size;

  // Load the initial status when navigating here
  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const status = await getClarificationStatus(leadId);
        if (mounted) {
          setClarificationStatus(status);
          if (status.status === "completed") {
            navigate({ to: "/pipeline", search: { leadId } });
          }
        }
      } catch (err) {
        console.error("Failed to fetch clarification status:", err);
      }
    };
    fetchStatus();
    return () => {
      mounted = false;
    };
  }, [leadId, navigate]);

  const handleSendClarificationAnswer = async (e?: React.FormEvent, answerOverride?: string) => {
    if (e) e.preventDefault();
    const answer = answerOverride || currentQuestionText;
    if (!answer.trim() || !leadId) return;

    if (!answerOverride) setCurrentQuestionText("");
    setIsQuerying(true);

    try {
      const status = await respondToClarification(leadId, answer);
      setClarificationStatus(status);

      if (status.status === "completed") {
        navigate({ to: "/pipeline", search: { leadId } });
      }
    } catch (err) {
      console.error(err);
      if (err instanceof NetworkError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to submit response.");
      }
    } finally {
      setIsQuerying(false);
    }
  };

  const handleSkipRemainingQuestions = async () => {
    setIsQuerying(true);
    try {
      const status = await skipRemainingClarification(leadId);
      setClarificationStatus(status);
      navigate({ to: "/pipeline", search: { leadId } });
    } catch (err) {
      console.error(err);
      if (err instanceof NetworkError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to skip questions.");
      }
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto glass-card gradient-border p-8 font-mono relative overflow-hidden text-left space-y-6 animate-fade-in transition-all rounded-2xl shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

        {/* Convoa AI Advisor Chat */}
        <div className="w-full flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/40">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                </span>
                <h3 className="text-foreground text-base font-bold uppercase tracking-tight font-mono flex items-center gap-2">
                  <span>Convoa AI Advisor</span>
                </h3>
              </div>
              {/* Reduced from a two-clause instructional sentence — the chat and the
                  answer chips explain themselves. */}
              <p className="text-[11px] text-foreground/75 mt-0.5 font-sans">
                A few quick questions to tailor your demo.
              </p>
            </div>

            {/* Within-step progress. The total number of questions varies per lead,
                so this counts answered questions rather than showing a fake total,
                and switches to an explicit "last one" state on the final question. */}
            <div className="flex items-center gap-2.5 shrink-0">
              {clarificationStatus?.is_final_question ? (
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-primary/15 border border-primary/35 text-primary px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5">
                  <Flag className="h-3 w-3" aria-hidden="true" />
                  Last question
                </span>
              ) : questionNumber > 0 ? (
                <span className="flex items-center gap-1.5" aria-label={`Question ${questionNumber}`}>
                  <span className="hidden sm:inline text-[9px] font-mono uppercase tracking-wider text-foreground/50">
                    Question {questionNumber}
                  </span>
                  <span className="flex items-center gap-1" aria-hidden="true">
                    {Array.from({ length: Math.min(questionNumber, 6) }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors",
                          i === Math.min(questionNumber, 6) - 1
                            ? "bg-primary"
                            : "bg-primary/35",
                        )}
                      />
                    ))}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Chat Conversation Thread */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-foreground/60 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                Advisor Strategy Thread
              </label>
              <span className="text-[10px] text-foreground/40 font-mono">
                {clarificationStatus?.conversation_history?.length || 0} messages
              </span>
            </div>

            <div className="h-72 border border-border/80 bg-background/60 backdrop-blur-sm p-4 space-y-3 overflow-y-auto font-sans text-xs flex flex-col justify-start rounded-lg shadow-inner">
              {messageGroups.length > 0 ? (
                messageGroups.map((group, gi) => {
                  const isLastGroup = gi === messageGroups.length - 1;
                  const showFinalBadge =
                    isLastGroup &&
                    group.role === "assistant" &&
                    !!clarificationStatus?.is_final_question;

                  if (group.role === "user") {
                    return (
                      <div key={gi} className="flex justify-end">
                        <div className="bg-success/15 border border-success/30 text-foreground p-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
                          <div className="text-[9px] font-mono font-bold text-success uppercase tracking-wider">
                            [YOU]
                          </div>
                          {group.contents.map((c, i) => (
                            <p
                              key={i}
                              className={cn(
                                "leading-relaxed font-sans text-xs mt-1",
                                i > 0 && "mt-2 pt-2 border-t border-success/20",
                              )}
                            >
                              {c}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={gi} className="flex justify-start">
                      <div
                        className={cn(
                          "p-3 rounded-2xl rounded-tl-none max-w-[88%] shadow-sm",
                          showFinalBadge
                            ? "bg-primary/10 border border-primary/40 text-foreground"
                            : "bg-secondary/60 border border-primary/30 text-foreground",
                        )}
                      >
                        {showFinalBadge && (
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <span className="text-[9px] text-primary font-mono font-bold uppercase tracking-wider bg-primary/20 px-2 py-0.5 rounded">
                              Final Question
                            </span>
                          </div>
                        )}
                        {group.contents.map((c, i) => (
                          <p
                            key={i}
                            className={cn(
                              "leading-relaxed font-sans text-xs text-foreground/90",
                              i > 0 && "mt-2.5 pt-2.5 border-t border-primary/15",
                            )}
                          >
                            {c}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-foreground/50 italic text-center py-8 font-sans text-xs flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <span>Convoa AI Advisor is analyzing requirements...</span>
                </div>
              )}

              {isQuerying && (
                <div className="flex justify-start animate-pulse">
                  <div className="bg-secondary/40 border border-border p-2.5 rounded-2xl rounded-tl-none text-[11px] font-mono text-foreground/60 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                    <span>Advisor is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Question Answer Recommendations Bar.
              Hidden while a request is in flight: the options belong to the question
              being replaced, so leaving them up makes them look static across turns. */}
          {!isQuerying && clarificationStatus?.recommendations && clarificationStatus.recommendations.length > 0 && (
            <div className="space-y-1.5 bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary font-bold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span>Recommended Answers (Click to select):</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {clarificationStatus.recommendations.map((rec, rIdx) => (
                  <button
                    key={`${rec}-${rIdx}`}
                    type="button"
                    onClick={(e) => handleSendClarificationAnswer(undefined, rec)}
                    disabled={isQuerying}
                    className="px-3 py-1.5 bg-background hover:bg-primary hover:text-primary-foreground border border-primary/30 text-foreground text-xs font-sans rounded-full transition-all duration-200 cursor-pointer hover:border-primary active:scale-95 flex items-center gap-1.5 font-medium disabled:opacity-50 shadow-sm"
                  >
                    <span>{rec}</span>
                    <ArrowRight className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Free-form Input Area */}
          <form
            onSubmit={handleSendClarificationAnswer}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={currentQuestionText}
              onChange={(e) => setCurrentQuestionText(e.target.value)}
              placeholder="Type your answer or select a recommended option above..."
              className={cn(INPUT_CLS, "rounded-md")}
              disabled={isQuerying || clarificationStatus?.status === "completed"}
            />
            <button
              type="submit"
              disabled={isQuerying || !currentQuestionText.trim() || clarificationStatus?.status === "completed"}
              className={cn(
                "px-5 py-2.5 font-mono font-semibold uppercase text-xs cursor-pointer border border-border h-full flex items-center gap-2 rounded-md transition-all",
                isQuerying || !currentQuestionText.trim() || clarificationStatus?.status === "completed"
                  ? "bg-secondary text-foreground/40 cursor-not-allowed"
                  : "bg-primary text-primary-foreground border-primary hover:bg-primary/90 active:scale-98 shadow-sm",
              )}
            >
              {isQuerying ? "Sending..." : "Send"}
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
            <span className="text-[9px] font-mono text-foreground/50 font-bold uppercase tracking-wider flex items-center gap-1 opacity-80">
              Quick replies:
            </span>
            {[
              "Yes, that's correct.",
              "No, not exactly.",
              "I don't know, use your best judgment.",
              "Can you give me an example?",
            ].map((reply, rIdx) => (
              <button
                key={rIdx}
                type="button"
                onClick={() => handleSendClarificationAnswer(undefined, reply)}
                disabled={isQuerying || clarificationStatus?.status === "completed"}
                className="text-[10px] font-sans px-2 py-1 bg-secondary/30 hover:bg-primary/15 hover:text-primary text-foreground/70 border border-border/40 hover:border-primary/40 rounded transition-all cursor-pointer text-left shadow-sm active:scale-95 disabled:opacity-50"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
          <button
            type="button"
            onClick={handleSkipRemainingQuestions}
            disabled={isQuerying || clarificationStatus?.status === "completed"}
            className="bg-transparent border border-border text-foreground hover:bg-secondary transition-colors font-mono font-medium text-xs tracking-wider uppercase px-5 py-3 cursor-pointer rounded disabled:opacity-50"
          >
            Skip remaining questions
          </button>

          {clarificationStatus?.status === "completed" ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/pipeline", search: { leadId } })}
              className="bg-success text-success-foreground hover:bg-success font-mono font-bold text-xs tracking-wider uppercase px-6 py-3 cursor-pointer border-0 active:scale-98 rounded-md shadow-lg shadow-success/20 animate-bounce-short flex items-center gap-2"
            >
              <span>Continue to Demo Setup</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendClarificationAnswer}
              disabled={isQuerying || !currentQuestionText.trim()}
              className={cn(
                "font-mono font-medium text-xs tracking-wider uppercase px-6 py-3 rounded-md transition-all",
                isQuerying || !currentQuestionText.trim()
                  ? "bg-secondary text-foreground/40 cursor-not-allowed border border-border"
                  : "bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer border-0 active:scale-98 shadow-sm"
              )}
            >
              Submit Answer →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
