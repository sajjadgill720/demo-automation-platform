import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Upload,
  X,
  Paperclip,
  Database,
  Loader2,
  ScanSearch,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  MessagesSquare,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  uploadClarificationDocument,
  setClarificationConsent,
  startClarification,
  NetworkError,
} from "@/lib/api";
import { z } from "zod";

const uploadSearchSchema = z.object({
  leadId: z.string(),
});

export const Route = createFileRoute("/_wizard/upload")({
  validateSearch: uploadSearchSchema,
  component: UploadRoute,
});

function UploadRoute() {
  const { leadId } = Route.useSearch();
  const navigate = useNavigate();

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [aiConsent, setAiConsent] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [stagingProgress, setStagingProgress] = useState<Record<string, number>>({});
  const intervalsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach((id) => clearInterval(id));
    };
  }, []);

  const simulateStaging = (files: File[]) => {
    files.forEach((file) => {
      const fileId = `${file.name}-${file.size}`;
      if (intervalsRef.current[fileId]) {
        clearInterval(intervalsRef.current[fileId]);
      }
      setStagingProgress((prev) => ({ ...prev, [fileId]: 0 }));
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          delete intervalsRef.current[fileId];
          toast.success(`"${file.name}" staged successfully!`, {
            id: `success-${fileId}`,
          });
        }
        setStagingProgress((prev) => ({ ...prev, [fileId]: progress }));
      }, 50);
      intervalsRef.current[fileId] = interval;
    });
  };
  const [dragActive, setDragActive] = useState(false);
  // What the busy state is actually doing, so the loading copy never claims to be
  // "processing documents" on the skip path (or when no file was attached).
  const [busyMode, setBusyMode] = useState<"docs" | "scoping" | null>(null);

  // Step-by-step progress states for document parsing/scoping
  const [ingestStepIndex, setIngestStepIndex] = useState(0);

  const ingestStepsDocs = [
    "Uploading document payload...",
    "Scanning document structure...",
    "Analyzing policies and workflows...",
    "Structuring business profile...",
    "Scoping custom clarification questions...",
  ];

  const ingestStepsNoDocs = [
    "Initializing scoping session...",
    "Structuring baseline profile...",
    "Determining clarification gap rules...",
  ];

  useEffect(() => {
    if (!isIngesting) {
      setIngestStepIndex(0);
      return;
    }
    const steps = uploadedFiles.length > 0 ? ingestStepsDocs : ingestStepsNoDocs;
    const interval = setInterval(() => {
      setIngestStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500); // Progress steps every 2.5s
    return () => clearInterval(interval);
  }, [isIngesting, uploadedFiles.length]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const allowedExtensions = ["pdf", "txt"];
      const newFiles: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          newFiles.push(file);
        } else {
          toast.error(`Invalid file type: ${file.name}. Only pdf and txt are allowed.`);
        }
      }
      if (newFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        setAiConsent(true);
        simulateStaging(newFiles);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const allowedExtensions = ["pdf", "txt"];
      const newFiles: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          newFiles.push(file);
        } else {
          toast.error(`Invalid file type: ${file.name}. Only pdf and txt are allowed.`);
        }
      }
      if (newFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        setAiConsent(true);
        simulateStaging(newFiles);
      }
    }
  };

  const removeFile = (idx: number) => {
    const file = uploadedFiles[idx];
    if (file) {
      const fileId = `${file.name}-${file.size}`;
      if (intervalsRef.current[fileId]) {
        clearInterval(intervalsRef.current[fileId]);
        delete intervalsRef.current[fileId];
      }
      setStagingProgress((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    }
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleProceedFromUpload = async () => {
    if (!aiConsent) {
      return handleSkipUploadStep();
    }
    // Only claim to be reading documents when a file is genuinely being sent.
    const hasDocs = uploadedFiles.length > 0;
    setBusyMode(hasDocs ? "docs" : "scoping");
    setIsIngesting(true);
    try {
      if (hasDocs) {
        // Upload every selected file, not just the first. The endpoint takes one
        // file per request, so each becomes its own Document row (and its own
        // Vapi knowledge-base file). Uploaded sequentially so a failure surfaces
        // the specific file that broke.
        for (const file of uploadedFiles) {
          await uploadClarificationDocument(leadId, file);
        }
        toast.success(
          uploadedFiles.length === 1
            ? "Document uploaded successfully."
            : `${uploadedFiles.length} documents uploaded successfully.`
        );
      }
      await setClarificationConsent(leadId, true);
      const status = await startClarification(leadId);
      
      if (status.status === "completed") {
        navigate({ to: "/pipeline", search: { leadId } });
      } else {
        navigate({ to: "/clarification", search: { leadId } });
      }
    } catch (err) {
      console.error(err);
      if (err instanceof NetworkError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to start solution scoping.");
      }
    } finally {
      setIsIngesting(false);
      setBusyMode(null);
    }
  };

  const handleSkipUploadStep = async () => {
    // No documents involved on this path — never show document-processing copy.
    setBusyMode("scoping");
    setIsIngesting(true);
    try {
      await setClarificationConsent(leadId, false);
      const status = await startClarification(leadId);
      
      if (status.status === "completed") {
        navigate({ to: "/pipeline", search: { leadId } });
      } else {
        navigate({ to: "/clarification", search: { leadId } });
      }
    } catch (err) {
      console.error(err);
      if (err instanceof NetworkError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to start solution scoping.");
      }
    } finally {
      setIsIngesting(false);
      setBusyMode(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="doc-ingestion-section w-full max-w-4xl mx-auto glass-card gradient-border p-8 font-mono relative overflow-hidden text-left space-y-6 animate-fade-in transition-all rounded-2xl shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-foreground text-xl font-bold tracking-tight font-sans">
              Make it sound like your team
            </h3>
            <span className="text-[9px] font-mono uppercase tracking-widest text-foreground/45 border border-border rounded-full px-2 py-0.5">
              Optional
            </span>
          </div>
        </div>

        {/* Icon-led explanation. Replaces the descriptive paragraph that used to
            sit here — the three steps carry the same meaning in far less text. */}
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
          {[
            { icon: Upload, label: "Share how you work", sub: "SOPs, call scripts, call logs" },
            { icon: ScanSearch, label: "We train your agent", sub: "It learns your rules" },
            { icon: Sparkles, label: "Hear it answer like you", sub: "Not a generic bot" },
          ].map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 sm:flex-col sm:text-center sm:gap-2">
              <div className="relative shrink-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <s.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {i < 2 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden sm:block absolute top-1/2 -right-[calc(50%+0.5rem)] h-3 w-3 -translate-y-1/2 text-foreground/25"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground/85 leading-tight">
                  {s.label}
                </p>
                <p className="text-[10px] text-foreground/50 font-sans mt-0.5">{s.sub}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Drag-and-drop zone OR in-place progress steps (swaps when processing starts) */}
        {isIngesting ? (
          /* ── In-place loading: occupies exactly the same space as the drop zone ── */
          <div
            role="status"
            aria-live="polite"
            className="border-2 border-dashed border-primary/40 bg-primary/[0.03] rounded-xl p-10 flex flex-col items-center justify-center gap-6 min-h-[180px] animate-fade-in"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {uploadedFiles.length > 0 ? "Analyzing Documents" : "Scoping Business"}
              </span>
            </div>

            <ul className="space-y-3 text-left w-full max-w-xs">
              {(uploadedFiles.length > 0 ? ingestStepsDocs : ingestStepsNoDocs).map((stepText, idx) => {
                const isDone = idx < ingestStepIndex;
                const isActive = idx === ingestStepIndex;
                const isTodo = idx > ingestStepIndex;
                return (
                  <li key={idx} className="flex items-center gap-3 transition-opacity duration-300">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border shrink-0 text-[10px]",
                        isDone && "bg-success/15 border-success/40 text-success",
                        isActive && "bg-primary/15 border-primary/40 text-primary",
                        isTodo && "border-border text-foreground/25"
                      )}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : isActive ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-sans",
                        isActive && "text-foreground font-semibold",
                        isDone && "text-foreground/60",
                        isTodo && "text-foreground/30"
                      )}
                    >
                      {stepText}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <>
            {/* Drag and Drop Container */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-upload-input")?.click()}
              className={cn(
                "doc-drop-zone border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 cursor-pointer text-center bg-secondary/10 relative rounded-xl",
                dragActive
                  ? "border-primary bg-primary/5 scale-[1.01] doc-drop-zone-active"
                  : "border-border hover:border-primary/50",
              )}
            >
              <input
                id="file-upload-input"
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".pdf,.txt"
                className="hidden"
              />

              <Upload className="h-10 w-10 text-foreground/60 hover:text-primary transition-colors" />

              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Drag and drop your files here, or{" "}
                  <span className="text-primary underline">browse</span>
                </p>
                <p className="text-[10px] text-foreground/50 font-sans">
                  Supports PDF and TXT up to 10MB each
                </p>
              </div>
            </div>

            {/* Uploaded Files List & Next-Step Interrelation Preview */}
            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* Left Column: Uploaded files list */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-foreground/70 font-mono border-b border-border pb-1 border-dashed">
                    Documents Staged ({uploadedFiles.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {uploadedFiles.map((file, idx) => {
                      const fileId = `${file.name}-${file.size}`;
                      const progress = stagingProgress[fileId] ?? 100;
                      const isStaging = progress < 100;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex flex-col p-3 bg-secondary/40 border text-xs rounded transition-all duration-300 relative overflow-hidden animate-fade-in",
                            isStaging ? "border-primary/30 bg-primary/[0.01]" : "border-border"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 truncate">
                              {isStaging ? (
                                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                              ) : (
                                <Paperclip className="h-4 w-4 text-primary shrink-0" />
                              )}
                              <span className="truncate font-medium text-foreground">
                                {file.name}
                              </span>
                              <span className="text-[10px] text-foreground/40 shrink-0 font-sans">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {isStaging ? (
                                <span className="text-[10px] font-mono text-primary/70">
                                  Staging {progress}%
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Ready
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(idx);
                                }}
                                className="p-1 hover:bg-secondary text-foreground/60 hover:text-destructive transition-colors cursor-pointer border-0 bg-transparent"
                                aria-label="Remove file"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {isStaging && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary/10">
                              <div
                                className="h-full bg-primary transition-all duration-75 ease-out"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* What happens next */}
                <div className="space-y-3 bg-secondary/20 border border-border p-4 flex flex-col justify-center rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-wider text-foreground/75 font-mono font-bold">
                      What you get
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    <li className="flex items-center gap-2.5">
                      <ScanSearch className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                      <span className="text-[11px] text-foreground/75 font-sans">
                        We read your {uploadedFiles.length === 1 ? "document" : `${uploadedFiles.length} documents`}
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <MessagesSquare className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                      <span className="text-[11px] text-foreground/75 font-sans">
                        A few quick questions — only what we can't infer
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                      <span className="text-[11px] text-foreground/75 font-sans">
                        A working agent you can call in minutes
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Consent toggle */}
            <div className="pt-2">
              <label
                className={cn(
                  "flex items-start gap-3 p-3.5 border cursor-pointer select-none transition-colors rounded",
                  aiConsent
                    ? "bg-primary/5 border-primary/40"
                    : "bg-secondary/40 border-border hover:border-primary/50",
                )}
              >
                <input
                  type="checkbox"
                  checked={aiConsent}
                  onChange={(e) => setAiConsent(e.target.checked)}
                  className="h-4 w-4 mt-0.5 accent-primary cursor-pointer rounded-none shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                    Train my agent on these docs
                  </span>
                  <span className="block text-[11px] text-foreground/60 font-sans mt-0.5">
                    This is what makes it sound like your team instead of a generic bot. Private, and deleted after 30 days.
                  </span>
                </span>
                <ShieldCheck
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 ml-auto shrink-0 transition-colors",
                    aiConsent ? "text-primary" : "text-foreground/25",
                  )}
                />
              </label>
            </div>
          </>
        )}

        {/* Actions Footer. Skip is a text link rather than a bordered button so it
            stays available without competing with the primary upload path. */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
          <button
            type="button"
            onClick={handleSkipUploadStep}
            disabled={isIngesting}
            className="inline-flex items-center gap-2 border-0 bg-yellow-400 text-black hover:bg-yellow-500 dark:bg-sky-500 dark:text-white dark:hover:bg-sky-600 font-sans text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleProceedFromUpload}
            disabled={isIngesting || (uploadedFiles.length > 0 && !aiConsent)}
            className={cn("bg-primary text-primary-foreground font-mono font-medium text-xs tracking-wider uppercase px-6 py-3 transition-all duration-200 border-0 rounded-xl btn-themed-shadow hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.97]",
              isIngesting || (uploadedFiles.length > 0 && !aiConsent)
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-primary/90 cursor-pointer"
            )}
          >
            {isIngesting ? (busyMode === "docs" ? "Training your agent..." : "Starting...") : "Build my agent →"}
          </button>
        </div>
      </div>
    </div>
  );
}
