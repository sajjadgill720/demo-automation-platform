import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, X, Paperclip, Database, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/upload")({
  validateSearch: uploadSearchSchema,
  component: UploadRoute,
});

function UploadRoute() {
  const { leadId } = Route.useSearch();
  const navigate = useNavigate();

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [aiConsent, setAiConsent] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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
      const allowedExtensions = ["pdf", "docx", "txt", "csv"];
      const newFiles: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          newFiles.push(file);
        } else {
          toast.error(`Invalid file type: ${file.name}. Only pdf, docx, txt, and csv are allowed.`);
        }
      }
      if (newFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        setAiConsent(true);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const allowedExtensions = ["pdf", "docx", "txt", "csv"];
      const newFiles: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          newFiles.push(file);
        } else {
          toast.error(`Invalid file type: ${file.name}. Only pdf, docx, txt, and csv are allowed.`);
        }
      }
      if (newFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        setAiConsent(true);
      }
    }
  };

  const removeFile = (idx: number) => {
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
    setIsIngesting(true);
    try {
      if (uploadedFiles.length > 0) {
        await uploadClarificationDocument(leadId, uploadedFiles[0]);
        toast.success("Document uploaded successfully.");
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
        toast.error("Failed to start clarification process.");
      }
    } finally {
      setIsIngesting(false);
    }
  };

  const handleSkipUploadStep = async () => {
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
        toast.error("Failed to start clarification process.");
      }
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto glass-card gradient-border p-8 font-mono relative overflow-hidden text-left space-y-6 animate-fade-in transition-all rounded-xl shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-[3px] gradient-line-animated" />

        <div>
          <h3 className="text-foreground text-lg font-bold uppercase tracking-tight font-mono">
            Step 1: Ingest Context Documents (Optional)
          </h3>
          <p className="text-xs text-foreground/75 mt-1 font-sans">
            Upload API specs, SOPs, databases descriptions, or call logs to feed your custom
            Knowledge Base. Skip if not needed.
          </p>
        </div>

        {/* Drag and Drop Container */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-upload-input")?.click()}
          className={cn(
            "border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 cursor-pointer text-center transition-all bg-secondary/10 relative rounded-lg",
            dragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50",
          )}
        >
          <input
            id="file-upload-input"
            type="file"
            multiple
            onChange={handleFileSelect}
            accept=".pdf,.docx,.txt,.csv"
            className="hidden"
          />

          {isIngesting ? (
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          ) : (
            <Upload className="h-10 w-10 text-foreground/60 hover:text-primary transition-colors" />
          )}

          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Drag and drop your files here, or{" "}
              <span className="text-primary underline">browse</span>
            </p>
            <p className="text-[10px] text-foreground/50 font-sans">
              Supports PDF, DOCX, TXT, CSV up to 10MB each
            </p>
          </div>
        </div>

        {/* Uploaded Files List & Next-Step Interrelation Preview */}
        {uploadedFiles.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Left Column: Uploaded files list */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-foreground/70 font-mono border-b border-border pb-1 border-dashed">
                Uploaded Documents ({uploadedFiles.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-secondary/40 border border-border text-xs rounded"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Paperclip className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate font-medium text-foreground">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-foreground/40 shrink-0 font-sans">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="p-1 hover:bg-secondary text-foreground/60 hover:text-rose-500 transition-colors cursor-pointer border-0 bg-transparent"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Interrelated Next-Step RAG Compilation Preview */}
            <div className="space-y-3 bg-secondary/20 border border-border p-4 relative overflow-hidden flex flex-col justify-between rounded-lg">
              <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-primary/10 border-l border-b border-border text-[8px] font-mono text-primary uppercase tracking-widest font-semibold animate-pulse rounded-bl">
                Step 2 Preview
              </div>

              <div className="space-y-2 text-left">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider text-foreground/75 font-mono font-bold">
                    Knowledge Base RAG Compiler
                  </span>
                </div>
                <p className="text-[10px] text-foreground/50 font-sans leading-relaxed">
                  Compiling context chunks from your uploaded{" "}
                  {uploadedFiles.length === 1
                    ? "document"
                    : `${uploadedFiles.length} documents`}
                  . The following verification queries will be ready for testing in Step 2:
                </p>
              </div>

              <div className="space-y-1.5 font-mono text-[9px] text-foreground/80 bg-background/30 p-2.5 border border-border/50 rounded">
                <div className="flex items-start gap-1">
                  <span className="text-amber-500 font-bold">Q1:</span>
                  <span className="truncate">
                    "What are the key requirements outlined in the uploaded spec?"
                  </span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-amber-500 font-bold">Q2:</span>
                  <span className="truncate">
                    "What integrations are mentioned in these documents?"
                  </span>
                </div>
              </div>

              <div className="text-[9px] text-emerald-500/90 font-mono flex items-center gap-1">
                <span className="h-1 w-1 bg-emerald-500 rounded-full animate-ping" />
                <span>Extraction Ready · advance to verify RAG responses</span>
              </div>
            </div>
          </div>
        )}

        {/* Consent Toggle / Checkbox */}
        <div className="pt-2">
          <label className="flex items-center gap-3 p-3.5 bg-secondary/40 border border-border cursor-pointer select-none text-xs font-mono text-foreground/80 hover:border-primary/50 transition-colors rounded">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={(e) => setAiConsent(e.target.checked)}
              className="h-4 w-4 accent-amber-500 cursor-pointer rounded-none"
            />
            <span>Allow AI to process uploaded documents to personalize your demo</span>
          </label>
        </div>

        {/* Loading State Overlay */}
        {isIngesting && (
          <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-50 gap-3 font-mono rounded-xl">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span className="text-xs uppercase tracking-widest text-primary animate-pulse font-bold">
              Processing documents & clarification state...
            </span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
          <button
            type="button"
            onClick={handleSkipUploadStep}
            disabled={isIngesting}
            className="bg-transparent border border-border text-foreground hover:bg-secondary transition-colors font-mono font-medium text-xs tracking-wider uppercase px-5 py-3 cursor-pointer rounded"
          >
            Skip this step
          </button>
          <button
            type="button"
            onClick={handleProceedFromUpload}
            disabled={isIngesting || (uploadedFiles.length > 0 && !aiConsent)}
            className={cn("bg-primary text-primary-foreground font-mono font-medium text-xs tracking-wider uppercase px-6 py-3 transition-all border-0 rounded",
              isIngesting || (uploadedFiles.length > 0 && !aiConsent)
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-primary/90 cursor-pointer"
            )}
          >
            {isIngesting ? "Processing..." : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
