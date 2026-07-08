import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Phone,
  Webhook,
  Calendar,
  Database,
  Mail,
  Upload,
  Trash2,
  Save,
  Plus,
  FileText,
  X,
  Volume2,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/voice-agent")({
  head: () => ({
    meta: [{ title: "Voice agent — DataQuartz" }],
  }),
  component: VoiceAgent,
});

interface FunctionItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  provider: string;
  active: boolean;
}

interface KBFile {
  name: string;
  size: string;
}

function VoiceAgent() {
  const [recording, setRecording] = useState(true);
  const [temp, setTemp] = useState(0.4);
  const [functions, setFunctions] = useState<FunctionItem[]>([
    { id: "1", icon: Calendar, name: "book_meeting", provider: "Google Calendar", active: true },
    { id: "2", icon: Database, name: "lookup_account", provider: "Salesforce", active: true },
    { id: "3", icon: Mail, name: "send_followup", provider: "Resend", active: false },
  ]);
  const [kbFiles, setKbFiles] = useState<KBFile[]>([
    { name: "Convoa-Product-Overview.pdf", size: "2.4 MB" },
    { name: "ABC-Logistics-Case-Study.pdf", size: "1.1 MB" },
    { name: "Freight-Industry-Glossary.md", size: "38 KB" },
  ]);

  // Dialog State
  const [showFuncModal, setShowFuncModal] = useState(false);
  const [newFuncName, setNewFuncName] = useState("");
  const [newFuncProvider, setNewFuncProvider] = useState("Salesforce");

  // Simulated File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUpdateAgent = () => {
    toast.success("Agent Convoa-EU-01 settings updated successfully!");
  };

  const handleDeleteAgent = () => {
    toast.error("Deletion not permitted in demo environment.", {
      description: "Please archive the active demo from the dashboard instead.",
    });
  };

  const handleCreateNewAgent = () => {
    toast.info("Creating agent wizard is locked.", {
      description: "Deployments are automatically provisioned during the Demo Generation flow.",
    });
  };

  const handleAddFunctionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFuncName.trim()) return;

    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      "Google Calendar": Calendar,
      Salesforce: Database,
      Resend: Mail,
      Other: Webhook,
    };

    const newFunc: FunctionItem = {
      id: Date.now().toString(),
      icon: iconMap[newFuncProvider] || Webhook,
      name: newFuncName.toLowerCase().replace(/\s+/g, "_"),
      provider: newFuncProvider,
      active: true,
    };

    setFunctions([...functions, newFunc]);
    toast.success(`Connected function '${newFunc.name}' added successfully!`);
    setNewFuncName("");
    setShowFuncModal(false);
  };

  const handleFileUploadSimulate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            setKbFiles((prev) => [...prev, { name: file.name, size: `${sizeMB} MB` }]);
            setIsUploading(false);
            toast.success(`Uploaded ${file.name} successfully to Retrieval Index.`);
          }, 400);
          return 100;
        }
        return p + 20;
      });
    }, 150);
  };

  const toggleFunctionActive = (id: string) => {
    setFunctions((funcs) => funcs.map((f) => (f.id === id ? { ...f, active: !f.active } : f)));
    const func = functions.find((f) => f.id === id);
    if (func) {
      toast.info(`Function '${func.name}' set to ${!func.active ? "Enabled" : "Disabled"}`);
    }
  };

  return (
    <>
      <TopNav title="Voice agent · Convoa-EU-01" />
      <div className="grid gap-6 p-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Waveform & Info */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">Convoa-EU-01</h2>
                  <StatusBadge tone="success">Live</StatusBadge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Deployed to ABC Logistics · agent id ag_9f4b21c0
                </p>
              </div>
              <Waveform />
            </div>

            <dl className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Provider" value="Vapi" />
              <Field label="Voice" value="ElevenLabs · Rachel (EN-US)" />
              <Field label="Language" value="English + German" />
              <Field label="LLM" value="GPT-4o mini" />
              <Field label="Temperature" value={temp.toFixed(2)}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="mt-1.5 w-full accent-primary"
                />
              </Field>
              <Field label="Phone number" value="+49 30 5683 4421" icon={Phone} />
              <Field label="Webhook" value="https://api.dataquartz.ai/vapi/hooks" icon={Webhook} />
            </dl>
          </div>

          {/* Connected Functions */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Connected functions</h3>
                <p className="text-xs text-muted-foreground">
                  Actions the agent can invoke mid-call
                </p>
              </div>
              <button
                onClick={() => setShowFuncModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Add function
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {functions.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleFunctionActive(f.id)}
                  className="group text-left"
                >
                  <FunctionCard
                    icon={f.icon}
                    name={f.name}
                    provider={f.provider}
                    active={f.active}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Knowledge base</h3>
              <p className="text-xs text-muted-foreground">
                Documents grounded into the agent's retrieval index
              </p>
            </div>

            <label className="block cursor-pointer rounded-lg border border-dashed p-6 text-center hover:bg-muted/40 transition-colors">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.md"
                onChange={handleFileUploadSimulate}
                disabled={isUploading}
              />
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Drop PDF, DOCX or MD files</p>
              <p className="text-xs text-muted-foreground">Max 25 MB per file</p>
            </label>

            {isUploading && (
              <div className="mt-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Uploading to retrieval index...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <ul className="mt-3 space-y-2">
              {kbFiles.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground/80">{f.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{f.size}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Call settings</h3>
            <label className="mt-4 flex items-center justify-between text-sm cursor-pointer">
              <span>
                <span className="font-medium text-foreground">Call recording</span>
                <p className="text-xs text-muted-foreground">Store and transcribe every call</p>
              </span>
              <button
                onClick={() => {
                  setRecording((r) => !r);
                  toast.info(`Call recording ${!recording ? "Enabled" : "Disabled"}`);
                }}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  recording ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    recording ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
            </label>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Agent actions</h3>
            <div className="mt-4 space-y-2">
              <button
                onClick={handleUpdateAgent}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Save className="h-4 w-4" /> Update agent
              </button>
              <button
                onClick={handleCreateNewAgent}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Plus className="h-4 w-4" /> Create new agent
              </button>
              <button
                onClick={handleDeleteAgent}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="h-4 w-4" /> Delete agent
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Function Interactive Modal */}
      <AnimatePresence>
        {showFuncModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowFuncModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md rounded-xl border bg-card p-6 shadow-lg z-10"
            >
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="text-sm font-semibold text-foreground">Add Custom Agent Function</h3>
                <button
                  onClick={() => setShowFuncModal(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleAddFunctionSubmit} className="mt-4 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-foreground">Function Name</span>
                  <input
                    placeholder="e.g. create_dispatch_ticket"
                    value={newFuncName}
                    onChange={(e) => setNewFuncName(e.target.value)}
                    required
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-foreground">Integrations Provider</span>
                  <select
                    value={newFuncProvider}
                    onChange={(e) => setNewFuncProvider(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Salesforce">Salesforce CRM</option>
                    <option value="Google Calendar">Google Calendar</option>
                    <option value="Resend">Resend Emails</option>
                    <option value="Other">Custom REST Webhook</option>
                  </select>
                </label>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowFuncModal(false)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Add Function
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-foreground/80">{value}</span>
      </dd>
      {children}
    </div>
  );
}

function FunctionCard({
  icon: Icon,
  name,
  provider,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  provider: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors duration-200 w-full",
        active
          ? "bg-background border-border"
          : "bg-muted/10 border-border/40 opacity-70 hover:opacity-100",
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <StatusBadge tone={active ? "success" : "muted"}>{active ? "On" : "Off"}</StatusBadge>
      </div>
      <p className="mt-2 font-mono text-xs text-foreground truncate">{name}</p>
      <p className="text-[11px] text-muted-foreground truncate">{provider}</p>
    </div>
  );
}

function Waveform() {
  const bars = 28;
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);

  // Web Audio Nodes refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    // Generate initial values for static pulse
    setAmplitudes(
      Array.from({ length: bars }).map((_, i) => 20 + Math.abs(Math.sin(i * 0.7)) * 40),
    );
  }, []);

  const handleStartMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error("Web Audio not supported");
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Small size for responsive mapping to 28 bars

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsMicTesting(true);
      toast.success("Live microphone testing connected. Speak to test the agent!");

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateWave = () => {
        analyser.getByteFrequencyData(dataArray);

        // Map bins to 28 heights
        const newAmps = Array.from({ length: bars }).map((_, idx) => {
          const val = dataArray[Math.floor((idx / bars) * dataArray.length)] || 0;
          return Math.max(8, val * 0.45); // Map to sensible visual height
        });

        setAmplitudes(newAmps);
        animRef.current = requestAnimationFrame(updateWave);
      };

      updateWave();
    } catch (err) {
      console.warn(err);
      toast.error("Could not access microphone.", {
        description: "Please check your browser permissions.",
      });
    }
  };

  const handleStopMic = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }

    // Reset states
    audioCtxRef.current = null;
    streamRef.current = null;
    setIsMicTesting(false);
    toast.info("Live microphone preview disconnected.");

    // Reset bars
    setAmplitudes(
      Array.from({ length: bars }).map((_, i) => 20 + Math.abs(Math.sin(i * 0.7)) * 40),
    );
  };

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex h-10 items-end gap-[3px]">
        {amplitudes.map((amp, i) => (
          <motion.span
            key={i}
            className={cn(
              "w-[3px] rounded-full transition-all",
              isMicTesting ? "bg-success" : "bg-primary/70",
            )}
            animate={
              isMicTesting
                ? { height: amp }
                : {
                    height: [amp * 0.4, amp, amp * 0.5],
                  }
            }
            transition={
              isMicTesting
                ? { type: "tween", duration: 0.1 }
                : {
                    duration: 1 + (i % 5) * 0.15,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: i * 0.04,
                    ease: "easeInOut",
                  }
            }
            style={{ height: isMicTesting ? amp : amp * 0.6 }}
          />
        ))}
      </div>

      <button
        onClick={isMicTesting ? handleStopMic : handleStartMic}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border transition-all shadow-sm",
          isMicTesting
            ? "border-success bg-success/10 text-success hover:bg-success/20 animate-pulse"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        {isMicTesting ? (
          <>
            <Volume2 className="h-3.5 w-3.5 text-success" /> Stop test
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" /> Start mic test
          </>
        )}
      </button>
    </div>
  );
}
