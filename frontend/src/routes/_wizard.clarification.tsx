import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
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
  "field-box w-full border-2 px-4 py-3 text-foreground placeholder:text-foreground/55 focus:outline-none font-sans text-sm transition-all duration-200 input-glow";

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
  // The user's answer, shown instantly on submit so it appears the moment they
  // click — rather than only after the backend round-trip returns it in history.
  // Cleared once the real status (which now contains it) comes back.
  const [optimisticAnswer, setOptimisticAnswer] = useState<string | null>(null);

  const [staticHistoryLength, setStaticHistoryLength] = useState(-1);
  const [currentTypingIndex, setCurrentTypingIndex] = useState(-1);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const flatMessages = useMemo(() => {
    const list: { role: string; content: string }[] = [];
    const history = clarificationStatus?.conversation_history ?? [];
    for (const m of history) {
      list.push({ role: m.role, content: m.content });
    }
    const pending = clarificationStatus?.current_question?.trim();
    if (
      pending &&
      !history.some((m) => m.role === "assistant" && m.content.trim() === pending)
    ) {
      list.push({ role: "assistant", content: pending });
    }
    return list;
  }, [clarificationStatus?.conversation_history, clarificationStatus?.current_question]);

  // Set the first new message to typewriter-animate
  useEffect(() => {
    if (staticHistoryLength !== -1 && flatMessages.length > staticHistoryLength) {
      if (currentTypingIndex < staticHistoryLength || currentTypingIndex >= flatMessages.length) {
        setCurrentTypingIndex(staticHistoryLength);
      }
    } else {
      setCurrentTypingIndex(-1);
    }
  }, [flatMessages.length, staticHistoryLength]);

  // Automatically advance currentTypingIndex if the message at that index is not from the assistant
  useEffect(() => {
    if (currentTypingIndex !== -1 && currentTypingIndex < flatMessages.length) {
      const msg = flatMessages[currentTypingIndex];
      if (msg && msg.role !== "assistant") {
        if (currentTypingIndex + 1 < flatMessages.length) {
          setCurrentTypingIndex(currentTypingIndex + 1);
        } else {
          setStaticHistoryLength(flatMessages.length);
          setCurrentTypingIndex(-1);
        }
      }
    }
  }, [currentTypingIndex, flatMessages]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Keep the just-submitted answer in view the instant it appears.
  useEffect(() => {
    if (optimisticAnswer) scrollToBottom();
  }, [optimisticAnswer]);

  const handleTypewriterComplete = (flatIndex: number) => {
    if (flatIndex === currentTypingIndex) {
      if (currentTypingIndex + 1 < flatMessages.length) {
        setCurrentTypingIndex(currentTypingIndex + 1);
      } else {
        setStaticHistoryLength(flatMessages.length);
        setCurrentTypingIndex(-1);
      }
    }
  };

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
    const groups: { role: string; items: { content: string; flatIndex: number }[] }[] = [];

    let flatIndex = 0;
    for (const m of history) {
      const last = groups[groups.length - 1];
      if (last && last.role === m.role) {
        last.items.push({ content: m.content, flatIndex });
      } else {
        groups.push({ role: m.role, items: [{ content: m.content, flatIndex }] });
      }
      flatIndex++;
    }

    const pending = clarificationStatus?.current_question?.trim();
    if (
      pending &&
      !history.some((m) => m.role === "assistant" && m.content.trim() === pending)
    ) {
      const last = groups[groups.length - 1];
      if (last && last.role === "assistant") {
        last.items.push({ content: pending, flatIndex });
      } else {
        groups.push({ role: "assistant", items: [{ content: pending, flatIndex }] });
      }
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
          
          const initialFlatCount = (status.conversation_history?.length || 0) + 
            (status.current_question && !status.conversation_history?.some(
              m => m.role === "assistant" && m.content.trim() === status.current_question?.trim()
            ) ? 1 : 0);
          setStaticHistoryLength(initialFlatCount);

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
    setOptimisticAnswer(answer);
    setIsQuerying(true);

    try {
      const status = await respondToClarification(leadId, answer);
      setClarificationStatus(status);
      setOptimisticAnswer(null);

      if (status.status === "completed") {
        navigate({ to: "/pipeline", search: { leadId } });
      }
    } catch (err) {
      console.error(err);
      setOptimisticAnswer(null);
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
      <div className="dq-form-surface w-full max-w-5xl mx-auto glass-card gradient-border p-10 md:p-14 relative overflow-hidden text-left space-y-8 animate-fade-in transition-all rounded-2xl border-2 border-border/60 bg-card">
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
                <h3 className="text-foreground text-lg md:text-xl font-bold uppercase tracking-tight font-sans flex items-center gap-2">
                  <span>Convoa AI Advisor</span>
                </h3>
              </div>
              {/* Reduced from a two-clause instructional sentence — the chat and the
                  answer chips explain themselves. */}
              <p className="text-sm text-foreground/90 mt-1 font-sans font-medium">
                A few quick questions to tailor your demo.
              </p>
            </div>

            {/* Within-step progress. The total number of questions varies per lead,
                so this counts answered questions rather than showing a fake total,
                and switches to an explicit "last one" state on the final question. */}
            <div className="flex items-center gap-2.5 shrink-0">
              {clarificationStatus?.is_final_question ? (
                <span className="text-xs font-sans font-bold uppercase tracking-wider bg-primary/15 border border-primary/35 text-primary px-3 py-1.5 rounded-full shrink-0 flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  Last question
                </span>
              ) : questionNumber > 0 ? (
                <span className="flex items-center gap-2" aria-label={`Question ${questionNumber}`}>
                  <span className="hidden sm:inline text-xs font-sans uppercase tracking-wider text-foreground/50 font-bold">
                    Question {questionNumber}
                  </span>
                  <span className="flex items-center gap-1.5" aria-hidden="true">
                    {Array.from({ length: Math.min(questionNumber, 6) }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-2 w-2 rounded-full transition-colors",
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
          </div>          {/* Chat Conversation Thread */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs md:text-sm font-sans uppercase tracking-wider text-foreground/85 flex items-center gap-2 font-bold">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                Advisor Strategy Thread
              </label>
              <span className="text-xs md:text-sm text-foreground/75 font-sans">
                {clarificationStatus?.conversation_history?.length || 0} messages
              </span>
            </div>

            <div
              ref={chatContainerRef}
              className="h-[30rem] md:h-[34rem] border-2 border-border/80 bg-background/60 backdrop-blur-sm p-4 space-y-4 overflow-y-auto font-sans text-xs flex flex-col justify-start rounded-lg shadow-inner"
            >
              {messageGroups.length > 0 ? (
                messageGroups.map((group, gi) => {
                  const isLastGroup = gi === messageGroups.length - 1;
                  const showFinalBadge =
                    isLastGroup &&
                    group.role === "assistant" &&
                    !!clarificationStatus?.is_final_question;

                  const visibleItems = group.items.filter((item) => {
                    return (
                      item.flatIndex < staticHistoryLength ||
                      (currentTypingIndex !== -1 && item.flatIndex <= currentTypingIndex)
                    );
                  });

                  if (visibleItems.length === 0) return null;

                  if (group.role === "user") {
                    return (
                      <div key={gi} className="flex justify-end animate-fade-in">
                        <div className="bg-success/15 border-2 border-success/30 text-foreground p-3.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
                          <div className="text-[10px] font-sans font-bold text-success uppercase tracking-wider mb-1.5">
                            [YOU]
                          </div>
                          {visibleItems.map((item, i) => (
                            <p
                              key={i}
                              className={cn(
                                "leading-relaxed font-sans text-sm md:text-base mt-1.5 text-foreground font-medium",
                                i > 0 && "mt-3 pt-3 border-t border-success/20",
                              )}
                            >
                              {item.content}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={gi} className="flex justify-start animate-fade-in">
                      <div
                        className={cn(
                          "p-3.5 rounded-2xl rounded-tl-none max-w-[88%] border-2 shadow-sm",
                          showFinalBadge
                            ? "bg-primary/10 border-primary/45 text-foreground"
                            : "bg-secondary/60 border-border/60 text-foreground",
                        )}
                      >
                        {showFinalBadge && (
                          <div className="flex items-center justify-end gap-2 mb-1.5">
                            <span className="text-[9.5px] text-primary font-sans font-bold uppercase tracking-wider bg-primary/20 px-2 py-0.5 rounded-md">
                              Final Question
                            </span>
                          </div>
                        )}
                        {visibleItems.map((item, i) => {
                          const shouldAnimate = staticHistoryLength !== -1 && item.flatIndex === currentTypingIndex;
                          return (
                            <p
                              key={i}
                              className={cn(
                                "leading-relaxed font-sans text-sm md:text-base text-foreground font-medium",
                                i > 0 && "mt-3 pt-3 border-t border-primary/15",
                              )}
                            >
                              <TypewriterParagraph
                                text={item.content}
                                shouldAnimate={shouldAnimate}
                                onType={scrollToBottom}
                                onComplete={() => handleTypewriterComplete(item.flatIndex)}
                              />
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-foreground/50 italic text-center py-8 font-sans text-xs flex flex-col items-center gap-2 m-auto font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                  </div>
                  <span>Analyzing requirements...</span>
                </div>
              )}

              {optimisticAnswer && (
                <div className="flex justify-end animate-fade-in">
                  <div className="bg-success/15 border-2 border-success/30 text-foreground p-3.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
                    <div className="text-[10px] font-sans font-bold text-success uppercase tracking-wider mb-1.5">
                      You
                    </div>
                    <p className="leading-relaxed font-sans text-sm md:text-base mt-1.5 text-foreground/90">
                      {optimisticAnswer}
                    </p>
                  </div>
                </div>
              )}

              {isQuerying && (
                <div className="flex justify-start">
                  <div className="bg-secondary/60 border-2 border-border p-3.5 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
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
            className="flex items-stretch gap-2.5"
          >
            <input
              type="text"
              value={currentQuestionText}
              onChange={(e) => setCurrentQuestionText(e.target.value)}
              placeholder="Type your answer or select a recommended option above..."
              className={cn(INPUT_CLS, "rounded-lg")}
              disabled={isQuerying || clarificationStatus?.status === "completed"}
            />
            <button
              type="submit"
              disabled={isQuerying || !currentQuestionText.trim() || clarificationStatus?.status === "completed"}
              className={cn(
                "px-6 font-sans font-bold uppercase text-sm cursor-pointer border-2 flex items-center justify-center gap-2 rounded-lg transition-all shrink-0",
                isQuerying || !currentQuestionText.trim() || clarificationStatus?.status === "completed"
                  ? "bg-secondary text-foreground/40 border-border cursor-not-allowed"
                  : "bg-yellow-400 text-black border-yellow-400 hover:bg-yellow-500 hover:border-yellow-500 dark:bg-sky-500 dark:text-white dark:border-sky-500 dark:hover:bg-sky-600 dark:hover:border-sky-600 btn-themed-shadow active:scale-98",
              )}
            >
              {isQuerying ? "Sending..." : "Send"}
            </button>
          </form>


        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
          <button
            type="button"
            onClick={handleSkipRemainingQuestions}
            disabled={isQuerying || clarificationStatus?.status === "completed"}
            className="inline-flex items-center gap-2 border-0 bg-yellow-400 text-black hover:bg-yellow-500 dark:bg-sky-500 dark:text-white dark:hover:bg-sky-600 font-sans text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]"
          >
            Skip for now
          </button>

          {clarificationStatus?.status === "completed" && (
            <button
              type="button"
              onClick={() => navigate({ to: "/pipeline", search: { leadId } })}
              className="bg-success text-success-foreground hover:bg-success font-mono font-bold text-xs tracking-wider uppercase px-6 py-3 cursor-pointer border-0 active:scale-98 rounded-md shadow-lg shadow-success/20 animate-bounce-short flex items-center gap-2"
            >
              <span>Continue to Demo Setup</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface TypewriterParagraphProps {
  text: string;
  shouldAnimate: boolean;
  onComplete?: () => void;
  onType?: () => void;
}

function TypewriterParagraph({ text, shouldAnimate, onComplete, onType }: TypewriterParagraphProps) {
  const [displayedText, setDisplayedText] = useState(shouldAnimate ? "" : text);
  const [isTyping, setIsTyping] = useState(shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    setDisplayedText("");
    setIsTyping(true);

    const words = text.split(" ");
    let currentWordIndex = 0;

    if (words.length > 0) {
      setDisplayedText(words[0]);
      onType?.();
    }

    const timer = setInterval(() => {
      currentWordIndex++;
      if (currentWordIndex < words.length) {
        setDisplayedText((prev) => prev + " " + words[currentWordIndex]);
        onType?.();
      } else {
        clearInterval(timer);
        setIsTyping(false);
        onComplete?.();
      }
    }, 30);

    return () => clearInterval(timer);
  }, [text, shouldAnimate]);

  return (
    <span>
      {displayedText}
      {isTyping && (
        <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse rounded-sm align-middle" />
      )}
    </span>
  );
}
