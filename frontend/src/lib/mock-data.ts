export type DemoStatus = "lead" | "research" | "prompt" | "agent" | "ready" | "sent" | "completed";

export type Product = "Audia" | "Chatquartz" | "QuartzGPT" | "DataWorks";

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  country: string;
  email: string;
  summary: string;
  painPoints: string[];
  recommendedProduct: Product;
  confidence: number;
  logoColor: string;
  logoInitials: string;
}

export interface DemoJob {
  id: string;
  company: Company;
  product: Product;
  status: DemoStatus;
  researchStatus: "queued" | "running" | "complete" | "failed";
  agentStatus: "idle" | "provisioning" | "live" | "expired";
  createdAt: string;
  expiresAt: string;
  views: number;
  calls: number;
  meetingBooked: boolean;
}

export const companies: Company[] = [
  {
    id: "abc-logistics",
    name: "ABC Logistics",
    domain: "abclogistics.com",
    industry: "Freight & Supply Chain",
    country: "Germany",
    email: "procurement@abclogistics.com",
    summary:
      "European mid-market 3PL operating 42 warehouses across DACH with a fleet of 380 vehicles. Legacy TMS with heavy manual dispatch overhead.",
    painPoints: [
      "Manual dispatch takes 6+ hours per shift",
      "No real-time visibility for enterprise shippers",
      "High driver churn from paper workflows",
    ],
    recommendedProduct: "Audia",
    confidence: 0.92,
    logoColor: "oklch(0.72 0.15 40)",
    logoInitials: "AL",
  },
  {
    id: "greenleaf-healthcare",
    name: "GreenLeaf Healthcare",
    domain: "greenleaf.health",
    industry: "Ambulatory Healthcare",
    country: "United States",
    email: "innovation@greenleaf.health",
    summary:
      "Network of 28 outpatient clinics in the Pacific Northwest. Currently piloting virtual triage; struggling with 40% no-show rate on scheduled follow-ups.",
    painPoints: [
      "40% follow-up no-show rate",
      "Front-desk teams overloaded with reminder calls",
      "Fragmented EHR notes between clinics",
    ],
    recommendedProduct: "Chatquartz",
    confidence: 0.88,
    logoColor: "oklch(0.72 0.17 149)",
    logoInitials: "GH",
  },
  {
    id: "technova",
    name: "TechNova",
    domain: "technova.io",
    industry: "B2B SaaS — DevTools",
    country: "United Kingdom",
    email: "growth@technova.io",
    summary:
      "Series B observability platform, 180 employees, 1,200+ paying teams. PLG motion with a growing enterprise pipeline that outpaces the SDR team.",
    painPoints: [
      "SDR team can't keep up with 4k weekly signups",
      "Manual demo scheduling costs 3 FTE",
      "Enterprise buyers want technical answers same-day",
    ],
    recommendedProduct: "QuartzGPT",
    confidence: 0.95,
    logoColor: "oklch(0.585 0.214 277)",
    logoInitials: "TN",
  },
  {
    id: "finserve",
    name: "FinServe",
    domain: "finserve.co",
    industry: "Wealth Management",
    country: "Singapore",
    email: "digital@finserve.co",
    summary:
      "APAC private wealth advisory managing $4.2B AUM. Regulatory pressure to log every client interaction; advisors resist manual note-taking.",
    painPoints: [
      "Compliance requires 100% call logging",
      "Advisor notes are inconsistent",
      "Onboarding a client takes 11 days average",
    ],
    recommendedProduct: "DataWorks",
    confidence: 0.83,
    logoColor: "oklch(0.55 0.14 240)",
    logoInitials: "FS",
  },
  {
    id: "retailflow",
    name: "RetailFlow",
    domain: "retailflow.com",
    industry: "Omnichannel Retail",
    country: "France",
    email: "cx@retailflow.com",
    summary:
      "European fashion retailer with 210 stores and a fast-growing DTC channel. Peak season overwhelms the contact center; CSAT drops 22 points in Q4.",
    painPoints: [
      "Contact center collapses during Q4 peaks",
      "Return workflows differ per country",
      "Loyalty program has 61% dormant members",
    ],
    recommendedProduct: "Chatquartz",
    confidence: 0.79,
    logoColor: "oklch(0.65 0.22 20)",
    logoInitials: "RF",
  },
];

export const products: {
  id: Product;
  tagline: string;
  description: string;
  bestFor: string;
}[] = [
  {
    id: "Audia",
    tagline: "Voice AI for operations",
    description:
      "Inbound + outbound voice agents for dispatch, logistics and field ops. Handles 40+ languages.",
    bestFor: "Logistics, field service, ops-heavy teams",
  },
  {
    id: "Chatquartz",
    tagline: "Conversational CX suite",
    description: "Omnichannel chat + voice for support and scheduling with EHR / OMS connectors.",
    bestFor: "Healthcare, retail, high-volume support",
  },
  {
    id: "QuartzGPT",
    tagline: "Technical AI assistant",
    description:
      "RAG-backed assistant trained on your docs, APIs and product schema for developer-heavy buyers.",
    bestFor: "SaaS, DevTools, product-led growth",
  },
  {
    id: "DataWorks",
    tagline: "Regulated data workflows",
    description: "Structured extraction, call logging and audit trails for regulated industries.",
    bestFor: "Finance, insurance, compliance-first teams",
  },
];

const now = new Date();
const days = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

export const demoJobs: DemoJob[] = [
  {
    id: "DMO-2041",
    company: companies[2],
    product: "QuartzGPT",
    status: "completed",
    researchStatus: "complete",
    agentStatus: "live",
    createdAt: days(-6),
    expiresAt: days(8),
    views: 34,
    calls: 11,
    meetingBooked: true,
  },
  {
    id: "DMO-2040",
    company: companies[0],
    product: "Audia",
    status: "sent",
    researchStatus: "complete",
    agentStatus: "live",
    createdAt: days(-4),
    expiresAt: days(10),
    views: 18,
    calls: 4,
    meetingBooked: false,
  },
  {
    id: "DMO-2039",
    company: companies[1],
    product: "Chatquartz",
    status: "ready",
    researchStatus: "complete",
    agentStatus: "live",
    createdAt: days(-3),
    expiresAt: days(11),
    views: 7,
    calls: 2,
    meetingBooked: true,
  },
  {
    id: "DMO-2038",
    company: companies[3],
    product: "DataWorks",
    status: "agent",
    researchStatus: "complete",
    agentStatus: "provisioning",
    createdAt: days(-2),
    expiresAt: days(12),
    views: 0,
    calls: 0,
    meetingBooked: false,
  },
  {
    id: "DMO-2037",
    company: companies[4],
    product: "Chatquartz",
    status: "research",
    researchStatus: "running",
    agentStatus: "idle",
    createdAt: days(-1),
    expiresAt: days(13),
    views: 0,
    calls: 0,
    meetingBooked: false,
  },
];

export const pipelineStages: { id: DemoStatus; label: string }[] = [
  { id: "lead", label: "Lead" },
  { id: "research", label: "Research" },
  { id: "prompt", label: "Prompt" },
  { id: "agent", label: "Vapi Agent" },
  { id: "ready", label: "Demo Ready" },
  { id: "sent", label: "Sent" },
  { id: "completed", label: "Completed" },
];

export const activityFeed = [
  {
    id: 1,
    company: "TechNova",
    action: "booked a 30-min meeting via demo agent",
    time: "12 min ago",
    tone: "success" as const,
  },
  {
    id: 2,
    company: "ABC Logistics",
    action: "opened the demo for the 3rd time",
    time: "48 min ago",
    tone: "info" as const,
  },
  {
    id: 3,
    company: "GreenLeaf Healthcare",
    action: "agent DMO-2039 went live",
    time: "2 h ago",
    tone: "info" as const,
  },
  {
    id: 4,
    company: "RetailFlow",
    action: "research pipeline started",
    time: "3 h ago",
    tone: "muted" as const,
  },
  {
    id: 5,
    company: "FinServe",
    action: "agent provisioning requires webhook secret",
    time: "5 h ago",
    tone: "warning" as const,
  },
];

export const researchSteps = [
  { id: "connect", label: "Connecting to sources" },
  { id: "scrape", label: "Scraping website" },
  { id: "extract", label: "Extracting services" },
  { id: "competitors", label: "Finding competitors" },
  { id: "industry", label: "Industry detection" },
  { id: "summary", label: "Business summary" },
  { id: "recommend", label: "Product recommendation" },
];
