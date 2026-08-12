/**
 * Before/after narratives for the demo preview, keyed by industry.
 *
 * WHY: the preview's "What changes for {company}" panel was hardcoded to a
 * logistics dispatch story — every lead saw "Manual dispatcher scheduling" and
 * "Descartes/Trimble logging" regardless of what business they actually run. A
 * dental practice was being shown freight software.
 *
 * These are HUMAN-WRITTEN marketing narratives, not generated at runtime and not
 * measured from the lead's own data. The `projection` line is an illustrative
 * claim shown under a "Projected" label — if you need it to be defensible, it
 * has to come from real measurement, not from this file.
 *
 * Matching mirrors the backend scenario library (app/scenario_library.py):
 * case-insensitive alias substring match, most specific alias wins, with a
 * complete generic fallback so no lead ever hits a blank panel.
 */

export interface IndustryNarrative {
  key: string;
  aliases: string[];
  /** Higher wins when a lead's industry string matches more than one entry. */
  specificity: number;
  /** What their day looks like today. */
  before: string[];
  /** What it looks like with Convoa answering. */
  after: string[];
  projection: string;
  /** Questions a real caller to this business asks, with how the demo agent
   *  answers. Shown on the preview so the client sees concrete handling, not a
   *  dead list of prompts. HUMAN-WRITTEN - never generated at runtime. */
  faqs: { q: string; a: string }[];
}

const NARRATIVES: IndustryNarrative[] = [
  {
    key: "logistics",
    specificity: 2,
    aliases: [
      "logistics",
      "freight",
      "transport",
      "trucking",
      "shipping",
      "supply chain",
      "courier",
      "fleet",
      "delivery",
    ],
    before: [
      "Tracking calls interrupt dispatchers mid-shift, every shift.",
      "Inbound queues drop callers during peak scheduling congestion.",
      "Load and reference numbers get keyed into your TMS by hand.",
    ],
    after: [
      "Status calls answered instantly, with the load reference captured up front.",
      "Every line answered at once, no queue, no dropped callers.",
      "Call details written straight into your systems, no copy-paste.",
    ],
    projection: "Faster status calls · zero missed dispatches",
    faqs: [
      {
        q: "Where's my shipment right now?",
        a: "I'll take your load or reference number and confirm dispatch will call straight back with the status. I won't guess at a location or an ETA.",
      },
      {
        q: "Can you quote a rate on a lane?",
        a: "I'll capture the origin, destination, weight, equipment and pickup date, and have a rep follow up with pricing.",
      },
      {
        q: "A driver has broken down, who do I talk to?",
        a: "That's urgent, so I take the load number and location and escalate it immediately rather than leaving a routine message.",
      },
    ],
  },
  {
    key: "healthcare",
    specificity: 1,
    aliases: ["healthcare", "health care", "medical", "clinic", "physician", "doctor", "wellness"],
    before: [
      "Front desk juggles the phone while patients wait at the counter.",
      "Calls roll to voicemail at lunch and after close.",
      "Appointment changes get written on paper, then re-entered later.",
    ],
    after: [
      "Every call answered, so staff stay with the patient in front of them.",
      "Booking requests captured around the clock, including lunch and evenings.",
      "Patient name, callback number and reason logged on the spot.",
    ],
    projection: "Fewer missed bookings · nothing lost to voicemail",
    faqs: [
      {
        q: "Can I get an appointment this week?",
        a: "I'll take your name, callback number and preferred timing, and confirm what happens next - no more waiting on hold at the desk.",
      },
      {
        q: "Are my test results back?",
        a: "Clinical staff have to handle results, so I take your details and pass the message on. I never read anything back from a record.",
      },
      {
        q: "This feels like an emergency.",
        a: "I tell the caller to hang up and call 911 or go to the nearest ER right away, and I don't try to book it as an appointment.",
      },
    ],
  },
  {
    key: "dental",
    specificity: 2,
    aliases: ["dental", "dentist", "orthodont", "oral"],
    before: [
      "New-patient calls go to voicemail while the desk is with a patient.",
      "Pain calls after hours wait until morning to be triaged.",
      "Insurance questions pull staff away from chairside work.",
    ],
    after: [
      "New-patient enquiries captured the moment they call.",
      "Urgent pain calls flagged and escalated instead of queued.",
      "Routine insurance questions handled without interrupting the team.",
    ],
    projection: "More new patients booked · urgent calls never queued",
    faqs: [
      {
        q: "Are you taking new patients?",
        a: "Yes, I collect name, phone, email and the reason for the visit, and explain what happens next, all without pulling the desk off chairside work.",
      },
      {
        q: "I'm in a lot of pain, can I be seen today?",
        a: "I treat pain as urgent: I take your name and number first, then follow the practice's emergency instruction rather than offering routine scheduling.",
      },
      {
        q: "Do you take my insurance?",
        a: "I only confirm plans the practice has given me; otherwise I take your insurer's name and the office verifies coverage and calls back.",
      },
    ],
  },
  {
    key: "legal",
    specificity: 2,
    aliases: ["legal", "law", "attorney", "solicitor", "lawyer", "litigation"],
    before: [
      "Prospective clients hang up when reception is on another line.",
      "Intake details get taken on notepads and retyped later.",
      "Deadline-sensitive calls sit in a voicemail box.",
    ],
    after: [
      "Every intake call answered, with the matter captured cleanly.",
      "Names, parties and dates recorded in a consistent format.",
      "Anything with a stated deadline escalated immediately.",
    ],
    projection: "More intakes captured · deadline calls escalated on the spot",
    faqs: [
      {
        q: "Do you handle this type of case?",
        a: "I capture the matter and your contact details, and explain an attorney reviews it before any advice. I never give a legal opinion on the call.",
      },
      {
        q: "There's a filing deadline coming up.",
        a: "Anything with a stated deadline I treat as time-critical: I capture the exact date and escalate immediately instead of a routine callback.",
      },
      {
        q: "What does a consultation cost?",
        a: "I share the consultation fee the firm has given me, and explain that matter fees are confirmed by the firm after intake.",
      },
    ],
  },
  {
    key: "hvac",
    specificity: 2,
    aliases: ["hvac", "climate control", "heating", "air conditioning", "furnace"],
    before: [
      "After-hours emergency calls hit voicemail and go to a competitor.",
      "Peak-season call volume overwhelms a single office line.",
      "Job details get relayed twice, caller to office, office to tech.",
    ],
    after: [
      "No-heat and no-cool calls captured any hour, address confirmed.",
      "Every caller answered at once, however busy the season gets.",
      "Job details captured once and passed straight to the on-call tech.",
    ],
    projection: "No after-hours jobs lost · every emergency call captured",
    faqs: [
      {
        q: "My system is completely dead, how soon can someone come?",
        a: "I treat a no-heat or no-cool call as urgent: confirm the address, check if anyone's vulnerable, and offer the earliest emergency slot before a routine one.",
      },
      {
        q: "What'll it cost to fix?",
        a: "I give the diagnostic fee if the business has provided it, and explain the repair price depends on the fault. I never invent a number.",
      },
      {
        q: "I smell gas.",
        a: "I tell the caller to leave the property and call their gas emergency line or 911 immediately, then end the call. I never book it as a job.",
      },
    ],
  },
  {
    key: "plumbing",
    specificity: 2,
    aliases: ["plumb", "drain", "sewer", "leak"],
    before: [
      "Burst-pipe calls at 2am reach a voicemail greeting.",
      "Callers with active leaks hang up and try the next number.",
      "Addresses and job details get taken down on scraps of paper.",
    ],
    after: [
      "Emergency calls answered instantly, water shut-off advice given first.",
      "Every caller reaches someone, so nobody moves down the list.",
      "Address and fault captured accurately on the first call.",
    ],
    projection: "Emergency calls answered instantly · no lost overnight jobs",
    faqs: [
      {
        q: "I've got water everywhere, help.",
        a: "I treat an active leak as an emergency: I walk you to the shut-off valve, confirm the address, and offer the earliest emergency slot.",
      },
      {
        q: "What's your call-out charge?",
        a: "I share the call-out fee if it's been provided, and explain the final cost depends on what the plumber finds on site.",
      },
      {
        q: "Do you work weekends and overnight?",
        a: "I answer from the hours the business has given me, and take your details for a callback if a slot needs confirming.",
      },
    ],
  },
  {
    key: "real_estate",
    specificity: 2,
    aliases: ["real estate", "realty", "property management", "lettings", "brokerage", "realtor"],
    before: [
      "Listing enquiries go cold while agents are out at viewings.",
      "Buyers call three agencies and sign with whoever rings back first.",
      "Tenant maintenance calls get triaged inconsistently.",
    ],
    after: [
      "Every listing enquiry answered, with the property captured up front.",
      "Contact details and qualification taken before they call anyone else.",
      "Maintenance issues sorted into urgent and routine automatically.",
    ],
    projection: "Faster lead response · no enquiry left waiting",
    faqs: [
      {
        q: "Is this listing still available?",
        a: "I capture which property, your contact details and whether you're pre-approved, and confirm an agent calls straight back, before you ring the next agency.",
      },
      {
        q: "Can I book a viewing?",
        a: "I collect the property, your preferred days and times and your contact details, and confirm the agent will lock in the slot.",
      },
      {
        q: "I'm a tenant with a maintenance problem.",
        a: "I check whether it affects heat, water, power or security - those I treat as urgent, everything else as a routine work order with the details captured.",
      },
    ],
  },
  {
    key: "hospitality",
    specificity: 2,
    aliases: ["hospitality", "hotel", "restaurant", "venue", "catering", "bookings"],
    before: [
      "Booking calls ring out during service, when nobody can pick up.",
      "Reservation changes get scribbled down and sometimes missed.",
      "Repeat questions about hours and parking eat into staff time.",
    ],
    after: [
      "Every booking call answered, including through the dinner rush.",
      "Changes and cancellations captured consistently.",
      "Routine questions answered without pulling anyone off the floor.",
    ],
    projection: "Every booking call answered · fewer no-shows from missed changes",
    faqs: [
      {
        q: "Can I make a booking?",
        a: "I take the date, party size and your contact details and confirm the reservation request, even through the dinner rush when nobody can reach the phone.",
      },
      {
        q: "I need to change my reservation.",
        a: "I capture your name, the existing booking and the change, and confirm it's passed on so nothing gets scribbled down and missed.",
      },
      {
        q: "What are your hours and is there parking?",
        a: "I answer routine questions like these straight from the venue's details, without pulling a member of staff off the floor.",
      },
    ],
  },
  {
    key: "finance",
    specificity: 2,
    aliases: ["finance", "banking", "insurance", "accounting", "mortgage", "advisory", "fintech"],
    before: [
      "Client calls queue behind whoever is already on the phone.",
      "Enquiries get routed to the wrong person and bounce around.",
      "Call notes end up in inboxes instead of the client record.",
    ],
    after: [
      "Every client reaches someone on the first try.",
      "Calls captured with enough detail to route correctly first time.",
      "Notes logged in a consistent format, ready to action.",
    ],
    projection: "First-call response every time · cleaner routing",
    faqs: [
      {
        q: "I need to speak to someone about my account.",
        a: "I take your name, callback number and what it's about, and route it to the right person so it doesn't bounce around or queue behind another call.",
      },
      {
        q: "Can you tell me my balance or account details?",
        a: "I don't read account details aloud - I confirm who you are, take a message and route it to the right person to call you back securely.",
      },
      {
        q: "Who handles new enquiries?",
        a: "I capture enough detail to route your enquiry correctly the first time, and confirm the right person will follow up.",
      },
    ],
  },
  {
    key: "education",
    specificity: 2,
    aliases: ["education", "school", "training", "academy", "tutoring", "university", "college"],
    before: [
      "Enrolment enquiries arrive in bursts the office cannot absorb.",
      "Parent calls go to voicemail during teaching hours.",
      "The same admissions questions get answered dozens of times a week.",
    ],
    after: [
      "Enrolment enquiries captured however many arrive at once.",
      "Every parent call answered, with a message taken if needed.",
      "Routine admissions questions handled without staff time.",
    ],
    projection: "No enquiry missed at intake · less time on repeat questions",
    faqs: [
      {
        q: "How do I enrol, and what are the next steps?",
        a: "I capture the student and your contact details and the programme of interest, and confirm admissions will follow up - however many enquiries arrive at once.",
      },
      {
        q: "Can I reach a teacher or the office?",
        a: "During teaching hours I take a clear message with your name and number and pass it on, rather than sending you to voicemail.",
      },
      {
        q: "What are your term dates and hours?",
        a: "Routine admissions questions like these I answer straight from the school's information, saving staff answering them dozens of times a week.",
      },
    ],
  },
  {
    key: "retail",
    specificity: 2,
    aliases: ["retail", "e-commerce", "ecommerce", "wholesale", "store", "shop", "merchandis"],
    before: [
      "Order and stock calls interrupt staff serving customers.",
      "Phone lines go unanswered at the busiest trading hours.",
      "Order references get taken verbally and mistyped.",
    ],
    after: [
      "Order and availability calls answered without pulling staff away.",
      "Every caller answered, including through peak trading.",
      "Order references captured accurately the first time.",
    ],
    projection: "Phones covered through peak · fewer mistyped orders",
    faqs: [
      {
        q: "Is this item in stock?",
        a: "I take the product and your contact details and confirm the team will check and come back - without pulling staff off the customer in front of them.",
      },
      {
        q: "Where's my order?",
        a: "I capture your order reference accurately the first time and confirm someone will follow up with the status.",
      },
      {
        q: "Can I return or exchange something?",
        a: "I take the order details and reason and confirm it's being passed to the team - I don't promise a refund or outcome on the call.",
      },
    ],
  },
];

const GENERIC: IndustryNarrative = {
  key: "generic",
  specificity: 0,
  aliases: [],
  before: [
    "Calls go unanswered when everyone is already busy.",
    "Enquiries reach voicemail outside office hours.",
    "Message details get written down by hand and re-entered later.",
  ],
  after: [
    "Every call answered, however many come in at once.",
    "Enquiries captured around the clock, not just 9 to 5.",
    "Caller name, number and reason logged consistently on the spot.",
  ],
  projection: "Every call answered · nothing lost to voicemail",
  faqs: [
    {
      q: "What do you offer, and how much is it?",
      a: "I answer from the business's own information where I have it, and where I don't, I take your details and confirm someone follows up rather than guessing.",
    },
    {
      q: "Can I speak to a specific person?",
      a: "I take your name, number and the reason for the call and confirm the message gets passed on.",
    },
    {
      q: "I've got a problem with my order or account.",
      a: "I acknowledge it, capture what happened and any reference, and confirm it's being escalated - I don't promise a resolution I can't guarantee.",
    },
  ],
};

/**
 * Resolves a free-text industry string to a narrative. Deterministic, and always
 * returns a complete entry so callers never handle a "not found" case.
 */
export function lookupNarrative(industry?: string | null): IndustryNarrative {
  if (!industry || !industry.trim()) return GENERIC;
  const haystack = industry.trim().toLowerCase();

  const direct = NARRATIVES.find((n) => n.key === haystack);
  if (direct) return direct;

  let best: IndustryNarrative | null = null;
  let bestRank: [number, number] = [-1, -1];
  for (const n of NARRATIVES) {
    for (const alias of n.aliases) {
      if (haystack.includes(alias)) {
        const rank: [number, number] = [n.specificity, alias.length];
        if (rank[0] > bestRank[0] || (rank[0] === bestRank[0] && rank[1] > bestRank[1])) {
          best = n;
          bestRank = rank;
        }
      }
    }
  }
  return best ?? GENERIC;
}
