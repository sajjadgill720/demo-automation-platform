import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Building,
  Key,
  Users,
  CreditCard,
  Cpu,
  Eye,
  EyeOff,
  Copy,
  Check,
  UserPlus,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — DataQuartz" }] }),
  component: Settings,
});

interface Member {
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Member" | "Invited";
  status: "active" | "pending";
}

function Settings() {
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showVapiApiKey, setShowVapiApiKey] = useState(false);
  const [region, setRegion] = useState("eu-frankfurt");
  const [llmProvider, setLlmProvider] = useState("gpt-4o-mini");
  const [voiceProvider, setVoiceProvider] = useState("eleven-rachel");

  // Team state
  const [members, setMembers] = useState<Member[]>([
    { name: "Elena Marchetti", email: "elena@dataquartz.ai", role: "Owner", status: "active" },
    { name: "Thomas Müller", email: "thomas@dataquartz.ai", role: "Admin", status: "active" },
    { name: "Sarah Jenkins", email: "sarah@dataquartz.ai", role: "Member", status: "active" },
    { name: "Alex Chen", email: "alex.chen@partner.com", role: "Invited", status: "pending" },
  ]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Member">("Member");

  // Integration switches states
  const [integrations, setIntegrations] = useState({
    descartes: false,
    trimble: false,
    alpega: false,
    salesforce: true,
    hubspot: false,
    resend: true,
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Workspace configuration saved successfully.");
  };

  const handleSaveVapi = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Vapi Voice Agent infrastructure credentials updated.");
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    if (members.length >= 25) {
      toast.error("Seat limit reached", {
        description: "Please upgrade your subscription plan to add more seats.",
      });
      return;
    }

    const name = inviteEmail.split("@")[0].replace(/[._]/g, " ");
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    const newMember: Member = {
      name: formattedName,
      email: inviteEmail.trim(),
      role: inviteRole,
      status: "pending",
    };

    setMembers([...members, newMember]);
    toast.success(`Invite sent successfully to ${inviteEmail}`);
    setInviteEmail("");
  };

  const toggleIntegration = (key: keyof typeof integrations, name: string) => {
    const nextState = !integrations[key];
    setIntegrations((prev) => ({ ...prev, [key]: nextState }));
    toast.info(`${name} integration ${nextState ? "connected" : "disconnected"}`);
  };

  const handleDangerZone = (action: string) => {
    toast.error(`Action Blocked: ${action}`, {
      description: "You do not have permission to execute destructive actions in this space.",
    });
  };

  return (
    <>
      <TopNav title="Settings" />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        <Tabs defaultValue="general" className="w-full">
          {/* Custom styled tabs list matching project's aesthetics */}
          <TabsList className="grid grid-cols-5 w-full max-w-xl h-10 mb-6 bg-muted/40 border p-1 rounded-lg">
            <TabsTrigger value="general" className="gap-1.5 py-1 text-xs">
              <Building className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="vapi" className="gap-1.5 py-1 text-xs">
              <Key className="h-3.5 w-3.5" /> Vapi (Voice)
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5 py-1 text-xs">
              <Users className="h-3.5 w-3.5" /> Team
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5 py-1 text-xs">
              <CreditCard className="h-3.5 w-3.5" /> Billing
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5 py-1 text-xs">
              <Cpu className="h-3.5 w-3.5" /> Integrations
            </TabsTrigger>
          </TabsList>

          {/* GENERAL SETTINGS */}
          <TabsContent value="general">
            <div className="space-y-6">
              <div className="elevated-card rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Workspace Profile</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Manage details of your organization workspace
                </p>

                <form onSubmit={handleSaveGeneral} className="space-y-4">
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold text-lg">
                      DQ
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Workspace Identifier
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Used for agent tags and organization filters
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 block">
                      <span className="text-xs font-medium text-foreground">Workspace Name</span>
                      <input
                        defaultValue="DataQuartz"
                        required
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-xs font-medium text-foreground">
                        Workspace Domain URL
                      </span>
                      <input
                        defaultValue="dataquartz.ai"
                        required
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-xs font-medium text-foreground">Workspace Slug</span>
                      <input
                        defaultValue="dataquartz"
                        required
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      />
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-xs font-medium text-foreground">
                        Primary Deployment Region
                      </span>
                      <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="eu-frankfurt">EU (Frankfurt)</option>
                        <option value="us-virginia">US East (N. Virginia)</option>
                        <option value="us-oregon">US West (Oregon)</option>
                      </select>
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Save Workspace profile
                    </button>
                  </div>
                </form>
              </div>

              {/* Danger Zone */}
              <div className="rounded-xl border border-destructive/20 bg-card p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-destructive" /> Danger Zone
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Irreversible management operations for this workspace
                </p>

                <div className="space-y-3 divide-y divide-border/60">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        Archive All Active Demos
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Instantly archives all prospects demo generation entries
                      </p>
                    </div>
                    <button
                      onClick={() => handleDangerZone("Archive All Demos")}
                      className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5"
                    >
                      Archive demos
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">Delete Workspace</p>
                      <p className="text-[11px] text-muted-foreground">
                        Completely delete data and de-provision Vapi infrastructure
                      </p>
                    </div>
                    <button
                      onClick={() => handleDangerZone("Delete Workspace")}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete workspace
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* VAPI / VOICE SETTINGS */}
          <TabsContent value="vapi">
            <div className="elevated-card rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Voice Agent Infrastructure</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Configure default credentials and LLM providers for Vapi
              </p>

              <form onSubmit={handleSaveVapi} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 block">
                    <span className="text-xs font-medium text-foreground">Vapi Org ID</span>
                    <input
                      defaultValue="org_dq_prod"
                      required
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                  </label>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Webhook Secret</span>
                      <button
                        type="button"
                        onClick={() => handleCopy("whsec_a8fd41103c85a2f", "Webhook Secret")}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </span>
                    <div className="relative">
                      <input
                        type={showWebhookSecret ? "text" : "password"}
                        value="whsec_a8fd41103c85a2f"
                        readOnly
                        className="w-full rounded-lg border bg-background pl-3 pr-10 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showWebhookSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Vapi API Token Key</span>
                      <button
                        type="button"
                        onClick={() => handleCopy("sk_vapi_••••••••••••e04b", "Vapi API Key")}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </span>
                    <div className="relative">
                      <input
                        type={showVapiApiKey ? "text" : "password"}
                        value="sk_vapi_9204bf310bdaee04b"
                        readOnly
                        className="w-full rounded-lg border bg-background pl-3 pr-10 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowVapiApiKey(!showVapiApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showVapiApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <label className="space-y-1.5 block">
                    <span className="text-xs font-medium text-foreground">
                      Global LLM Orchestration Provider
                    </span>
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="gpt-4o-mini">
                        GPT-4o mini (Low latency, high reliability)
                      </option>
                      <option value="claude-35">Claude 3.5 Sonnet (Context reasoning)</option>
                      <option value="llama3-70b">Llama 3 70B (Open weights)</option>
                    </select>
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-xs font-medium text-foreground">
                      Default Agent TTS Voice
                    </span>
                    <select
                      value={voiceProvider}
                      onChange={(e) => setVoiceProvider(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="eleven-rachel">
                        ElevenLabs Rachel (EN-US, Conversational)
                      </option>
                      <option value="playht-susan">PlayHT Susan (Real-time latency focus)</option>
                      <option value="deepgram-aura">
                        Deepgram Aura (Ultra low-latency speech)
                      </option>
                    </select>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Save API credentials
                  </button>
                </div>
              </form>
            </div>
          </TabsContent>

          {/* TEAM MEMBERS */}
          <TabsContent value="team">
            <div className="space-y-6">
              <div className="elevated-card rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-sm font-semibold text-foreground">Workspace Seats</h2>
                  <span className="text-xs font-medium text-foreground">
                    {members.length} / 25 seats filled
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Enterprise scale workspace allowance limit
                </p>

                {/* Seats Progress Bar */}
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-6">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(members.length / 25) * 100}%` }}
                  />
                </div>

                <form
                  onSubmit={handleInviteMember}
                  className="flex flex-col sm:flex-row items-end gap-3 p-4 rounded-lg bg-muted/30 border mb-6"
                >
                  <label className="flex-1 space-y-1 block">
                    <span className="text-xs font-medium text-foreground">Invite Member Email</span>
                    <input
                      type="email"
                      placeholder="e.g. name@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </label>

                  <label className="space-y-1 block min-w-[120px]">
                    <span className="text-xs font-medium text-foreground">Role</span>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "Admin" | "Member")}
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="Member">Member</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors h-[38px] shrink-0"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Invite
                  </button>
                </form>

                {/* Team Members List */}
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-3 font-semibold text-muted-foreground">User</th>
                        <th className="p-3 font-semibold text-muted-foreground">Role</th>
                        <th className="p-3 font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {members.map((m, idx) => (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{m.name}</div>
                            <div className="text-[11px] text-muted-foreground">{m.email}</div>
                          </td>
                          <td className="p-3 font-medium text-foreground/80">{m.role}</td>
                          <td className="p-3">
                            <StatusBadge tone={m.status === "active" ? "success" : "warning"}>
                              {m.status === "active" ? "Active" : "Pending"}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* BILLING SETTINGS */}
          <TabsContent value="billing">
            <div className="space-y-6">
              <div className="elevated-card rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Current Subscription</h2>
                    <p className="text-xs text-muted-foreground">
                      Your plan renews on July 24, 2026
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-foreground">Enterprise scale</span>
                    <span className="text-xs text-muted-foreground">$850.00 / month</span>
                  </div>
                </div>

                {/* Metered usage indicators */}
                <div className="space-y-4 mb-6">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Vapi Voice Minutes</span>
                      <span>1,420 / 5,000 mins</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "28.4%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Prospect Demo Generations</span>
                      <span>142 / 500 demos</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "28.4%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Seats allowance</span>
                      <span>18 / 25 seats</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: "72%" }} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t">
                  <button
                    onClick={() => handleDangerZone("Upgrade Plan")}
                    className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Upgrade features <Sparkles className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDangerZone("Manage Customer Portal")}
                    className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg border px-4 py-2 text-foreground hover:bg-muted transition-colors"
                  >
                    Customer billing portal <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Invoices List */}
              <div className="elevated-card rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Invoices history</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  View and download your invoices receipts
                </p>

                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-3 font-semibold text-muted-foreground">Invoice ID</th>
                        <th className="p-3 font-semibold text-muted-foreground">Date</th>
                        <th className="p-3 font-semibold text-muted-foreground">Amount</th>
                        <th className="p-3 font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr
                        className="hover:bg-muted/10 cursor-pointer"
                        onClick={() => handleDangerZone("Download Receipt INV-2041")}
                      >
                        <td className="p-3 font-semibold text-primary">INV-2041</td>
                        <td className="p-3 text-muted-foreground">Jun 24, 2026</td>
                        <td className="p-3">$850.00</td>
                        <td className="p-3">
                          <StatusBadge tone="success">Paid</StatusBadge>
                        </td>
                      </tr>
                      <tr
                        className="hover:bg-muted/10 cursor-pointer"
                        onClick={() => handleDangerZone("Download Receipt INV-2040")}
                      >
                        <td className="p-3 font-semibold text-primary">INV-2040</td>
                        <td className="p-3 text-muted-foreground">May 24, 2026</td>
                        <td className="p-3">$850.00</td>
                        <td className="p-3">
                          <StatusBadge tone="success">Paid</StatusBadge>
                        </td>
                      </tr>
                      <tr
                        className="hover:bg-muted/10 cursor-pointer"
                        onClick={() => handleDangerZone("Download Receipt INV-2039")}
                      >
                        <td className="p-3 font-semibold text-primary">INV-2039</td>
                        <td className="p-3 text-muted-foreground">Apr 24, 2026</td>
                        <td className="p-3">$850.00</td>
                        <td className="p-3">
                          <StatusBadge tone="success">Paid</StatusBadge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* INTEGRATIONS SETTINGS */}
          <TabsContent value="integrations">
            <div className="elevated-card rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">TMS & CRM Integrations</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Connect external accounts and systems with DataQuartz pipelines
              </p>

              <div className="space-y-4 divide-y divide-border">
                {/* Transport Management Systems */}
                <div className="space-y-3 pt-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Transport Management Systems (TMS)
                  </h4>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Descartes Integration</p>
                      <p className="text-[11px] text-muted-foreground">
                        Push shipment tasks and sync real-time TMS state
                      </p>
                    </div>
                    <Switch
                      checked={integrations.descartes}
                      onCheckedChange={() => toggleIntegration("descartes", "Descartes")}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Trimble TMS Integration
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Trigger automated driver dispatch alerts from call outputs
                      </p>
                    </div>
                    <Switch
                      checked={integrations.trimble}
                      onCheckedChange={() => toggleIntegration("trimble", "Trimble")}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Alpega TMS Integration
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Map carrier routes and schedule time slots
                      </p>
                    </div>
                    <Switch
                      checked={integrations.alpega}
                      onCheckedChange={() => toggleIntegration("alpega", "Alpega")}
                    />
                  </div>
                </div>

                {/* CRMs & Other Services */}
                <div className="space-y-3 pt-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    CRM and Communication Hubs
                  </h4>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Salesforce CRM</p>
                      <p className="text-[11px] text-muted-foreground font-medium text-success">
                        Connected to Salesforce org 'org_dq_sf'
                      </p>
                    </div>
                    <Switch
                      checked={integrations.salesforce}
                      onCheckedChange={() => toggleIntegration("salesforce", "Salesforce")}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">HubSpot CRM</p>
                      <p className="text-[11px] text-muted-foreground">
                        Log conversation summary and call metrics directly to contact timeline
                      </p>
                    </div>
                    <Switch
                      checked={integrations.hubspot}
                      onCheckedChange={() => toggleIntegration("hubspot", "HubSpot")}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Resend Email Delivery Service
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium text-success">
                        Active for automated meeting reminders
                      </p>
                    </div>
                    <Switch
                      checked={integrations.resend}
                      onCheckedChange={() => toggleIntegration("resend", "Resend")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
