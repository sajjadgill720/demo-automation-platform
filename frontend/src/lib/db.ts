import { DemoJob, Company, companies, demoJobs, activityFeed, Product } from "./mock-data";

const DEMOS_KEY = "dq_demos";
const ACTIVITY_KEY = "dq_activity";

// Safely get from local storage (safe for SSR)
export function getStoredDemos(): DemoJob[] {
  if (typeof window === "undefined") return demoJobs;
  const stored = localStorage.getItem(DEMOS_KEY);
  if (!stored) {
    localStorage.setItem(DEMOS_KEY, JSON.stringify(demoJobs));
    return demoJobs;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return demoJobs;
  }
}

export function saveDemos(demos: DemoJob[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(DEMOS_KEY, JSON.stringify(demos));
    // Trigger custom event so other components know data changed
    window.dispatchEvent(new Event("dq-demos-updated"));
  }
}

export function getStoredActivity() {
  if (typeof window === "undefined") return activityFeed;
  const stored = localStorage.getItem(ACTIVITY_KEY);
  if (!stored) {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityFeed));
    return activityFeed;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return activityFeed;
  }
}

export function addActivity(
  companyName: string,
  actionText: string,
  tone: "success" | "warning" | "info" | "muted" = "info",
) {
  if (typeof window === "undefined") return;
  const current = getStoredActivity();
  const newItem = {
    id: Date.now(),
    company: companyName,
    action: actionText,
    time: "Just now",
    tone,
  };
  const updated = [newItem, ...current];
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("dq-activity-updated"));
}

export function addDemoJob(
  companyData: {
    name: string;
    website?: string;
    email?: string;
    industry?: string;
    country?: string;
  },
  product: Product,
  sources: string[],
) {
  const demos = getStoredDemos();
  const nextIdNum =
    demos.length > 0
      ? Math.max(...demos.map((d) => parseInt(d.id.replace("DMO-", "")) || 0)) + 1
      : 2042;
  const newId = `DMO-${nextIdNum}`;

  const initials = companyData.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const colors = [
    "oklch(0.72 0.15 40)",
    "oklch(0.72 0.17 149)",
    "oklch(0.585 0.214 277)",
    "oklch(0.55 0.14 240)",
    "oklch(0.65 0.22 20)",
  ];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const companyObj: Company = {
    id: companyData.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    name: companyData.name,
    domain: companyData.website?.replace(/https?:\/\/(www\.)?/, "") || "unknown.com",
    industry: companyData.industry || "Technology",
    country: companyData.country || "United States",
    email: companyData.email || `contact@${companyData.name.toLowerCase().replace(/\s/g, "")}.com`,
    summary: `Personalized profile compiled from crawled sources: ${sources.join(", ")}. Heavy focus on optimization and automation solutions.`,
    painPoints: [
      "Inbound traffic scaling issues",
      "Manual scheduling workflow delays",
      "Customer response latency",
    ],
    recommendedProduct: product,
    confidence: 0.85 + Math.random() * 0.12,
    logoColor: randomColor,
    logoInitials: initials || "CO",
  };

  const newJob: DemoJob = {
    id: newId,
    company: companyObj,
    product,
    status: "research",
    researchStatus: "running",
    agentStatus: "idle",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    views: 0,
    calls: 0,
    meetingBooked: false,
  };

  const updatedDemos = [newJob, ...demos];
  saveDemos(updatedDemos);

  addActivity(companyObj.name, "created a new demo generation pipeline", "muted");

  // Simulate progress in the background (using client-side timer)
  if (typeof window !== "undefined") {
    // Stage 1: Scrape
    setTimeout(() => {
      updateDemoStatus(newId, { researchStatus: "running", status: "research" });
      addActivity(companyObj.name, "completed source scraping & crawl", "info");
    }, 4000);

    // Stage 2: Prompt Configuration
    setTimeout(() => {
      updateDemoStatus(newId, { researchStatus: "complete", status: "prompt" });
      addActivity(companyObj.name, "AI prompt engineering completed tailoring pitch", "info");
    }, 8000);

    // Stage 3: Provisioning Agent
    setTimeout(() => {
      updateDemoStatus(newId, { agentStatus: "provisioning", status: "agent" });
      addActivity(companyObj.name, "provisioning Vapi voice agent in EU-Frankfurt", "info");
    }, 12000);

    // Stage 4: Ready
    setTimeout(() => {
      updateDemoStatus(newId, { agentStatus: "live", status: "ready" });
      addActivity(companyObj.name, "personalized AI voice demo is ready", "success");
    }, 16000);
  }

  return newJob;
}

export function updateDemoStatus(id: string, updates: Partial<DemoJob>) {
  const demos = getStoredDemos();
  const updated = demos.map((d) => {
    if (d.id === id) {
      return { ...d, ...updates };
    }
    return d;
  });
  saveDemos(updated);
}
