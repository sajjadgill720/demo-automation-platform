import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  FileText,
  Mail,
  Cable,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { ProgressTimeline } from "@/components/common/ProgressTimeline";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addDemoJob } from "@/lib/db";

export const Route = createFileRoute("/_app/new-demo")({
  head: () => ({
    meta: [
      { title: "Discovery Wizard — DataQuartz" },
      {
        name: "description",
        content:
          "Discover operational parameters, analyze leakage, and design your AI Voice routing pipeline.",
      },
    ],
  }),
  component: NewDemo,
});

const steps = [
  { id: "business", label: "Business Info" },
  { id: "calendar", label: "Booking Setup" },
  { id: "routing", label: "Escalation & CRM" },
  { id: "summary", label: "Proposal Summary" },
];

function NewDemo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    company: "Northwind Freight",
    email: "ops@northwindfreight.com",
    missedCalls: 25,
    bookingValue: 150,
    calendarSystem: "calendly",
    bookingRequirements: ["name", "phone", "reason"],
    escalationPath: "send_sms_link",
    integrationDestination: "email_digest",
  });

  // Load the latest configuration from the database on mount to allow editing
  useEffect(() => {
    const loadLatestDiscovery = async () => {
      const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";
      let hasData = false;
      try {
        const res = await fetch(`${API_URL}/api/discovery`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const latest = data[0]; // Descending order, so [0] is the most recent
            setForm({
              company: latest.company_name,
              email: latest.contact_email,
              missedCalls: latest.missed_calls_per_week,
              bookingValue: latest.average_booking_value,
              calendarSystem: latest.calendar_system,
              bookingRequirements: latest.booking_requirements
                ? latest.booking_requirements.split(",")
                : ["name", "phone", "reason"],
              escalationPath: latest.escalation_path,
              integrationDestination: latest.integration_destination,
            });
            toast.info(`Loaded latest configuration for ${latest.company_name}`);
            hasData = true;
          }
        }
      } catch (err) {
        console.error("Could not fetch latest discovery response:", err);
      }

      // If no data was loaded from backend, try prefilling from localStorage (onboarding intake form)
      if (!hasData && typeof window !== "undefined") {
        const localData = localStorage.getItem("convoa_demo_preview_data");
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (parsed.company || parsed.email) {
              setForm((prev) => ({
                ...prev,
                company: parsed.company || prev.company,
                email: parsed.email || prev.email,
              }));
              toast.info(`Pre-filled from onboarding info: ${parsed.company || parsed.email}`);
            }
          } catch (e) {
            console.error("Error parsing onboarding local storage data:", e);
          }
        }
      }
    };
    loadLatestDiscovery();
  }, []);

  // Calculate monthly leakage dynamically: (calls * 4.34) * value * 25% conversion
  const calculatedLeakage = Math.round(form.missedCalls * 4.34 * form.bookingValue * 0.25);

  const toggleRequirement = (req: string) => {
    setForm((prev) => ({
      ...prev,
      bookingRequirements: prev.bookingRequirements.includes(req)
        ? prev.bookingRequirements.filter((r) => r !== req)
        : [...prev.bookingRequirements, req],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

    try {
      const res = await fetch(`${API_URL}/api/discovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company,
          contact_email: form.email,
          missed_calls_per_week: form.missedCalls,
          average_booking_value: form.bookingValue,
          calendar_system: form.calendarSystem,
          booking_requirements: form.bookingRequirements.join(","),
          escalation_path: form.escalationPath,
          integration_destination: form.integrationDestination,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Sync with the client-side dashboard state (add the job to list & fire simulation timers)
        addDemoJob(
          {
            name: form.company,
            email: form.email,
          },
          "Convoa",
          ["Form Configuration Wizard"],
        );

        toast.success(
          `Pipeline successfully created! Monthly leakage logged at $${data.calculated_monthly_leakage.toLocaleString()}`,
        );
        navigate({ to: "/dashboard" });
      } else {
        toast.error("Failed to save discovery settings on server.");
      }
    } catch (err) {
      toast.error("Connection failed. Make sure your Python backend is running.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopNav title="System Design Wizard" />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        <ProgressTimeline steps={steps} currentIndex={step} orientation="horizontal" />

        <div className="elevated-card rounded-xl border bg-card p-6 shadow-sm">
          {/* Step 0: Business Info & Revenue Calculator */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Operational Profiling</h2>
                <p className="text-sm text-muted-foreground">
                  Understand company parameters and estimate leakage from unanswered customer calls.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Company name"
                  value={form.company}
                  onChange={(v) => setForm({ ...form, company: v })}
                />
                <Field
                  label="Contact email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
                <NumberField
                  label="Avg. Missed Calls / Week"
                  value={form.missedCalls}
                  onChange={(v) => setForm({ ...form, missedCalls: v })}
                />
                <NumberField
                  label="Avg. Booking / Ticket Value ($)"
                  value={form.bookingValue}
                  onChange={(v) => setForm({ ...form, bookingValue: v })}
                />
              </div>
            </div>
          )}

          {/* Step 1: Calendar System & Parameters */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Booking System Integration
                </h2>
                <p className="text-sm text-muted-foreground">
                  Where should the scheduling take place, and what information is required?
                </p>
              </div>
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-foreground">
                    Select Calendar Service
                  </span>
                  <select
                    value={form.calendarSystem}
                    onChange={(e) => setForm({ ...form, calendarSystem: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="calendly">Calendly Integration</option>
                    <option value="google_calendar">Google Calendar</option>
                    <option value="cal_com">Cal.com API</option>
                    <option value="custom_crm">Direct Custom CRM API</option>
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-foreground block">
                    Required Client Details to Book
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { id: "name", label: "Full Name" },
                      { id: "phone", label: "Phone Number" },
                      { id: "email", label: "Email Address" },
                      { id: "reason", label: "Service / Booking Reason" },
                      { id: "postal_code", label: "Postal / Zip Code" },
                    ].map((item) => {
                      const checked = form.bookingRequirements.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleRequirement(item.id)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border text-sm text-left transition-colors bg-background",
                            checked
                              ? "border-primary bg-primary/5 text-foreground"
                              : "hover:border-foreground/15",
                          )}
                        >
                          <span>{item.label}</span>
                          <div
                            className={cn(
                              "h-4 w-4 border rounded flex items-center justify-center",
                              checked
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border",
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Escalation & Integrations */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Escalation & Delivery Routing
                </h2>
                <p className="text-sm text-muted-foreground">
                  Define agent logic behavior for exceptions and specify where data details are
                  transmitted.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-foreground block">
                    Agent Escalation Path
                  </span>
                  <div className="grid gap-3">
                    {[
                      {
                        id: "send_sms_link",
                        label: "Send SMS Booking Link",
                        desc: "Sends a self-serve calendar link to caller's mobile device automatically.",
                      },
                      {
                        id: "transfer_to_agent",
                        label: "Transfer to Human Agent",
                        desc: "Pipes connection immediately to a live dispatch or office number.",
                      },
                      {
                        id: "take_voicemail",
                        label: "Record Voicemail",
                        desc: "Takes client details and fires a notification digest to your operations team.",
                      },
                    ].map((item) => {
                      const selected = form.escalationPath === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setForm({ ...form, escalationPath: item.id })}
                          className={cn(
                            "p-3 rounded-lg border text-left flex items-start gap-3 bg-background transition-colors",
                            selected ? "border-primary bg-primary/5" : "hover:border-foreground/15",
                          )}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full border flex items-center justify-center mt-0.5",
                              selected ? "border-primary" : "border-border",
                            )}
                          >
                            {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-foreground">
                    CRM / Sync Destination
                  </span>
                  <select
                    value={form.integrationDestination}
                    onChange={(e) => setForm({ ...form, integrationDestination: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="email_digest">Immediate Email Digest</option>
                    <option value="salesforce">Salesforce Enterprise CRM</option>
                    <option value="hubspot">HubSpot contacts pipeline</option>
                    <option value="webhook">Custom API Webhook</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Summary */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Discovery Summary</h2>
                <p className="text-sm text-muted-foreground">
                  Review the system layout and calculations before submitting requirements.
                </p>
              </div>
              <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 text-sm">
                <SummaryRow label="Company Name" value={form.company} />
                <SummaryRow label="Contact Email" value={form.email} />
                <SummaryRow label="Weekly Missed Calls" value={`${form.missedCalls} calls`} />
                <SummaryRow label="Average Booking Value" value={`$${form.bookingValue}`} />
                <SummaryRow
                  label="Selected Scheduler"
                  value={form.calendarSystem.replace("_", " ").toUpperCase()}
                />
                <SummaryRow
                  label="Required Parameters"
                  value={form.bookingRequirements.join(", ")}
                />
                <SummaryRow
                  label="Escalation Rules"
                  value={form.escalationPath.replace(/_/g, " ").toUpperCase()}
                />
                <SummaryRow
                  label="Integration Hub"
                  value={form.integrationDestination.replace("_", " ").toUpperCase()}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer border-0 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Save discovery layout
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function SummaryRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-foreground font-mono", className)}>{value}</dd>
    </div>
  );
}
