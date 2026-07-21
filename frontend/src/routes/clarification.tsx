import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/clarification")({
  validateSearch: clarificationSearchSchema,
  component: ClarificationRoute,
});

function ClarificationRoute() {
  const { leadId } = Route.useSearch();
  const navigate = useNavigate();

  const [clarificationStatus, setClarificationStatus] = useState<ClarificationStatusResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentQuestionText, setCurrentQuestionText] = useState("");

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto glass-card gradient-border p-8 font-mono relative overflow-hidden text-left space-y-6 animate-fade-in transition-all rounded-xl shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

        {/* Convoa AI Advisor Chat */}
        <div className="w-full flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h3 className="text-foreground text-base font-bold uppercase tracking-tight font-mono flex items-center gap-2">
                  <span>Convoa AI Advisor</span>
                </h3>
              </div>
              <p className="text-[11px] text-foreground/75 mt-0.5 font-sans">
                Interactive solution refinement loop — answer questions or select recommended responses.
              </p>
            </div>
            <span className="text-[9px] font-mono uppercase bg-primary/10 border border-primary/30 text-primary px-2.5 py-1 rounded-full font-semibold shrink-0">
              Step 2 of 3
            </span>
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
              {clarificationStatus?.conversation_history && clarificationStatus.conversation_history.length > 0 ? (
                <>
                  {clarificationStatus.conversation_history.map((msg, idx) => (
                    <div key={idx} className="space-y-1 text-left">
                      {msg.role === "user" ? (
                        <div className="flex justify-end">
                          <div className="bg-emerald-500/15 border border-emerald-500/30 text-foreground p-3 rounded-2xl rounded-tr-none max-w-[85%] space-y-1 shadow-sm">
                            <div className="flex items-center justify-between gap-2 text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                              <span>[YOU]</span>
                            </div>
                            <p className="leading-relaxed font-sans text-xs">{msg.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <div className="bg-secondary/60 border border-primary/30 text-foreground p-3 rounded-2xl rounded-tl-none max-w-[88%] space-y-1 shadow-sm">
                            <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-primary uppercase tracking-wider">
                              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                              <span>[CONVOA AI]</span>
                            </div>
                            <p className="leading-relaxed font-sans text-xs text-foreground/90">{msg.content}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Render current_question ONLY if it is not already in the history */}
                  {clarificationStatus?.current_question &&
                   !clarificationStatus.conversation_history.some((m) => m.role === "assistant" && m.content.trim() === (clarificationStatus.current_question || "").trim()) && (
                    <div className="flex justify-start">
                      <div className="bg-secondary/60 border border-primary/30 text-foreground p-3 rounded-2xl rounded-tl-none max-w-[88%] space-y-1 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-primary uppercase tracking-wider">
                          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                          <span>[CONVOA AI]</span>
                        </div>
                        <p className="leading-relaxed font-sans text-xs text-foreground/90">{clarificationStatus.current_question}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : clarificationStatus?.current_question ? (
                <div className="flex justify-start">
                  <div className="bg-secondary/60 border border-primary/30 text-foreground p-3 rounded-2xl rounded-tl-none max-w-[88%] space-y-1 shadow-sm">
                    <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-primary uppercase tracking-wider">
                      <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                      <span>[CONVOA AI]</span>
                    </div>
                    <p className="leading-relaxed font-sans text-xs text-foreground/90">{clarificationStatus.current_question}</p>
                  </div>
                </div>
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

          {/* AI Question Answer Recommendations Bar */}
          {clarificationStatus?.recommendations && clarificationStatus.recommendations.length > 0 && (
            <div className="space-y-1.5 bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary font-bold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span>Recommended Answers (Click to select):</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {clarificationStatus.recommendations.map((rec, rIdx) => (
                  <button
                    key={rIdx}
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
              disabled={isQuerying}
            />
            <button
              type="submit"
              disabled={isQuerying || !currentQuestionText.trim()}
              className={cn(
                "px-5 py-2.5 font-mono font-semibold uppercase text-xs cursor-pointer border border-border h-full flex items-center gap-2 rounded-md transition-all",
                isQuerying || !currentQuestionText.trim()
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
                disabled={isQuerying}
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
            disabled={isQuerying}
            className="bg-transparent border border-border text-foreground hover:bg-secondary transition-colors font-mono font-medium text-xs tracking-wider uppercase px-5 py-3 cursor-pointer rounded"
          >
            Skip remaining questions
          </button>
          <button
            type="button"
            onClick={handleSendClarificationAnswer}
            disabled={isQuerying || !currentQuestionText.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/95 font-mono font-medium text-xs tracking-wider uppercase px-6 py-3 cursor-pointer border-0 active:scale-98 rounded-md"
          >
            Submit & Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
