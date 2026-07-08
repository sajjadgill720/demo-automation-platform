# Implementation Plan - DataQuartz Platform Setup & Feature Enhancements

This document outlines the setup of the DataQuartz platform, including library installations, page improvements, and the Settings page redesign.

---

## 1. Libraries & Dependencies Setup

The project includes all necessary configurations in `package.json`. Run the following command inside your project directory to install them:

```bash
# Using bun (recommended based on bun.lock presence)
bun install

# Using npm (alternative)
npm install
```

### Dependency Breakdown

| Library                                 | Purpose                                                              |
| :-------------------------------------- | :------------------------------------------------------------------- |
| **react** / **react-dom**               | Core React 19 framework providing the UI layer.                      |
| **@tanstack/react-router**              | Type-safe routing engine for building SPA page states.               |
| **@tanstack/react-start**               | Server-side rendering (SSR) web framework wrapper.                   |
| **@tanstack/react-query**               | State manager for caching, fetching, and updating server state.      |
| **tailwindcss** / **@tailwindcss/vite** | Tailwind CSS v4 compiler and Vite integration.                       |
| **framer-motion**                       | Animation engine for route transitions, waveforms, and live logging. |
| **lucide-react**                        | SVG icon set optimized for React.                                    |
| **recharts**                            | Composability-based charts library for performance metrics.          |
| **sonner**                              | Global Toast notification alerts.                                    |
| **zod**                                 | TypeScript schema validator.                                         |
| **react-hook-form**                     | Form states and validation manager.                                  |
| **Radix UI Primitives**                 | Headless accessible components (Tabs, Switches, Dialogs, etc.).      |

---

## 2. Dashboard UI & Charts

- **Interactive Performance Chart**: Added an area chart using `recharts` to track prospect views and calls over the last 9 days.
- **Dynamic Counters**: Connected metrics (Total Demos, Running Jobs, Active Vapi Agents, Booked Meetings) to calculate dynamically from a stateful mock list.
- **Recent Activities Log**: Added a "Clear activities" action that empties the live event feed dynamically.

---

## 3. New Demo Wizard & State Persistence

- **State Persistence**: Created a database utility helper (`db.ts`) which stores created demos in `localStorage`.
- **Form Integration**: Submitting the form adds a new job with `"research"` status to the database, syncing the dashboard counters in real time.
- **Background Pipeline Loader**: Added background timers that simulate progressive status changes (`research` -> `prompt` -> `agent` -> `ready`) over time, logging activities at each step.

---

## 4. Voice Agent Panel

- **Web Audio Mic Tester**: Clicking the "Start mic test" button triggers user microphone permissions and pipes real-world speech frequencies to animate the 28 visual waveform bars in real time.
- **Save Updates Toasts**: Integrated success notifications to mock agent updates and warning alerts for delete restrictions.
- **Add Connected Function Dialog**: Integrated an interactive popup modal to select an integration provider and connect custom functions.
- **Retrieval Index File Uploader**: Interactive file selector that triggers simulated upload progress logs.

---

## 5. Active Demos Console

- **Link Copier**: Triggering the actions dropdown copy link copies a client preview portal URL directly to the user's system clipboard.
- **Demo Archiving**: Configured "Archive demo" to remove jobs from `localStorage` and trigger reactive state refreshes across views.
- **Client Route Portal**: Configured "View demo" to route the admin straight to the client-facing portal page.

---

## 6. Settings Page Redesign

Replaced the basic placeholder card with a detailed, tabbed configuration console:

1. **General**: Edit workspace profile (Slug, name, region) and trigger danger actions.
2. **Vapi (Voice)**: Manage API keys (show/hide toggle), organization IDs, and customize LLM orchestration defaults (GPT-4o vs Claude 3.5).
3. **Team Crew**: Track seat allowances (18 of 25 filled) via progress gauges, view members and roles (Owner, Admin, Member), and invite teammates dynamically.
4. **Billing**: View active metered usage meters (scraped pages, audio minutes, seats limits) and invoice history.
5. **Integrations**: Interactive toggles to connect enterprise Transport Management Systems (Descartes, Trimble, Alpega) or Salesforce/HubSpot CRMs.

---

## 7. Global Light & Dark Mode Toggle

- **Theme Hook**: Created a unified hook (`use-theme.tsx`) to persist themes in `localStorage` and toggle the `.dark` class on the root document element.
- **Navigation Toggle Button**: Added a Sun/Moon toggle to `TopNav.tsx` to switch theme globally.
- **Demo Portal Sync**: Hooked up `demo-preview.tsx` to the global theme manager, keeping all customer-facing and back-office states in sync.
