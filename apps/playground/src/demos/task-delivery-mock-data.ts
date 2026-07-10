import { demoLeadPerson, type ProjectLeadPerson } from "@nqlib/nqgrid";

export type TaskStatus = "in_progress" | "done" | "backlog";
export type TaskPriority = "urgent" | "high" | "medium";

export type TaskDeliveryRow = {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: ProjectLeadPerson;
  priority: TaskPriority;
  project: string;
  done: boolean;
  bucket: "active" | "backlog";
  subRows?: TaskDeliveryRow[];
};

const TEAM: ProjectLeadPerson[] = [
  demoLeadPerson("Maya Perez"),
  demoLeadPerson("Jonas Reed"),
  demoLeadPerson("Priya Shah"),
  demoLeadPerson("Alex Rivera"),
  demoLeadPerson("Sam Okonkwo"),
  demoLeadPerson("Jordan Lee"),
  demoLeadPerson("Chen Wei"),
  demoLeadPerson("Riley Park"),
];

const PROJECTS = [
  "Registry API",
  "Launch Analytics",
  "Billing Flow",
  "Auth Platform",
  "Integrations Hub",
  "Mobile SDK",
  "Admin Console",
  "Data Pipeline",
] as const;

const PRIORITIES: TaskPriority[] = ["urgent", "high", "medium"];

const ACTIVE_EPICS: readonly { title: string; project: (typeof PROJECTS)[number]; subtasks: readonly string[] }[] = [
  {
    title: "Ship registry token validation for entitlement payloads",
    project: "Registry API",
    subtasks: [
      "Lock the signed entitlement payload behind the registry token check",
      "Add rotation handler for signing keys",
      "Publish OpenAPI diff for v2 entitlement endpoints",
      "Backfill audit events for legacy token issuances",
    ],
  },
  {
    title: "Instrument launch funnel for analytics workspace",
    project: "Launch Analytics",
    subtasks: [
      "Define event schema for signup and activation milestones",
      "Wire dashboard tiles to the new funnel dataset",
      "Add cohort breakdown for paid conversion",
      "Validate event volume against staging baseline",
    ],
  },
  {
    title: "Reconcile proration line items on annual plan upgrades",
    project: "Billing Flow",
    subtasks: [
      "Map credit memo types to ledger accounts",
      "Fix negative line items on mid-cycle seat changes",
      "Add regression fixtures for EU VAT scenarios",
    ],
  },
  {
    title: "Harden SCIM provisioning for enterprise tenants",
    project: "Auth Platform",
    subtasks: [
      "Support group push from Okta custom attributes",
      "Deprovision stale seats within 15 minutes",
      "Document required admin scopes in customer guide",
    ],
  },
  {
    title: "Rebuild HubSpot sync for custom object mappings",
    project: "Integrations Hub",
    subtasks: [
      "Resolve 403 on workspace-scoped OAuth refresh",
      "Batch upserts for deals above 10k rows",
      "Surface field mapping conflicts in setup UI",
    ],
  },
  {
    title: "Offline queue for mobile field uploads",
    project: "Mobile SDK",
    subtasks: [
      "Persist retry queue across app restarts",
      "Compress photo attachments before upload",
      "Expose sync status in host app callback",
    ],
  },
  {
    title: "Role-based access for admin audit exports",
    project: "Admin Console",
    subtasks: [
      "Gate CSV export behind org-admin role",
      "Redact PII columns for support-tier users",
      "Add download rate limit per workspace",
    ],
  },
  {
    title: "Migrate nightly usage aggregates to columnar store",
    project: "Data Pipeline",
    subtasks: [
      "Dual-write events during cutover window",
      "Validate row counts against legacy warehouse",
      "Update BI dashboards to new datasource",
      "Document rollback procedure for on-call",
    ],
  },
  {
    title: "Webhook signature verification after key rotation",
    project: "Registry API",
    subtasks: [
      "Accept overlapping signing keys for 72 hours",
      "Emit structured logs on verification failures",
      "Notify integrators via status page banner",
    ],
  },
  {
    title: "Self-serve tax ID validation for EU entities",
    project: "Billing Flow",
    subtasks: [
      "Integrate VIES lookup with cached responses",
      "Block checkout when validation is inconclusive",
      "Store validation timestamp on customer record",
    ],
  },
  {
    title: "Slack alert routing for incident channels",
    project: "Integrations Hub",
    subtasks: [
      "Map severity levels to channel overrides",
      "Retry failed deliveries with exponential backoff",
      "Add test ping from integration settings",
    ],
  },
  {
    title: "Passkey enrollment fallback for legacy browsers",
    project: "Auth Platform",
    subtasks: [
      "Detect WebAuthn support before showing CTA",
      "Route to TOTP when passkeys unavailable",
      "Track enrollment funnel drop-off by browser",
    ],
  },
  {
    title: "Experiment tracking for pricing page variants",
    project: "Launch Analytics",
    subtasks: [
      "Assign stable variant ids in edge middleware",
      "Exclude bot traffic from experiment denominators",
      "Ship weekly readout template for growth team",
    ],
  },
  {
    title: "Bulk seat import from CSV for sales ops",
    project: "Admin Console",
    subtasks: [
      "Validate email domains against allowlist",
      "Preview diff before committing import",
      "Send invite emails in throttled batches",
    ],
  },
  {
    title: "Reduce cold start for edge image transforms",
    project: "Mobile SDK",
    subtasks: [
      "Warm critical paths on app foreground",
      "Cache transform presets locally",
      "Benchmark on low-end Android devices",
    ],
  },
  {
    title: "Backfill missing rate-limit headers on export API",
    project: "Registry API",
    subtasks: [
      "Align limit windows with gateway config",
      "Return Retry-After on 429 responses",
      "Update client SDK retry guidance",
    ],
  },
  {
    title: "Annual renewal reminders with usage summary",
    project: "Billing Flow",
    subtasks: [
      "Pull usage totals for email template",
      "Suppress reminders for auto-renew contracts",
      "A/B subject line for finance approvers",
    ],
  },
  {
    title: "Real-time pipeline lag dashboard for on-call",
    project: "Data Pipeline",
    subtasks: [
      "Ingest Kafka consumer lag metrics",
      "Page when lag exceeds 5 minutes",
      "Link runbook from alert payload",
    ],
  },
  {
    title: "Customer-facing status page for API incidents",
    project: "Admin Console",
    subtasks: [
      "Sync incident state from PagerDuty",
      "Show component-level degradation",
      "Subscribe form with email confirmation",
    ],
  },
  {
    title: "Deep link handling for password reset flows",
    project: "Mobile SDK",
    subtasks: [
      "Verify universal links on iOS 17+",
      "Fallback to in-app browser on Android",
      "Expire tokens after first successful use",
    ],
  },
];

const BACKLOG_TITLES: readonly string[] = [
  "Draft SCIM group mapping spec for enterprise tenants",
  "Evaluate columnar store for feature flag analytics",
  "Design approval workflow for production config changes",
  "Spike GraphQL subscription transport for live boards",
  "Consolidate duplicate webhook endpoints per workspace",
  "Add keyboard shortcuts overlay to admin tables",
  "Research SOC2 evidence collection automation",
  "Prototype natural language filter for task views",
  "Unify error codes across public REST surface",
  "Plan deprecation timeline for v1 export formats",
  "Survey customers on multi-region data residency",
  "Outline sandbox billing mode for sales demos",
  "Review accessibility audit for color-only status cues",
  "Document disaster recovery RPO for auth cluster",
  "Investigate Postgres read replica lag for reports",
  "Spec team-level task templates with subtask presets",
  "Explore PDF invoice localization for APAC",
  "Define retention policy for deleted workspace artifacts",
  "Benchmark TanStack virtualizer with 100k flat rows",
  "Collect requirements for custom task status workflows",
];

const DONE_SNIPPETS = [
  "Write migration script",
  "Add unit tests",
  "Update changelog",
  "Verify in staging",
  "Request security review",
  "Ship behind feature flag",
] as const;

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function subtaskStatus(subIndex: number, total: number): TaskStatus {
  if (subIndex < Math.floor(total * 0.35)) return "done";
  if (subIndex === total - 1 && total > 2) return "backlog";
  return "in_progress";
}

function buildSubRows(
  parentId: string,
  project: string,
  assignee: ProjectLeadPerson,
  priority: TaskPriority,
  titles: readonly string[],
  bucket: "active" | "backlog",
): TaskDeliveryRow[] {
  return titles.map((title, i) => {
    const status = subtaskStatus(i, titles.length);
    return {
      id: `${parentId}-s${i + 1}`,
      title,
      status,
      assignee: pick(TEAM, i + assignee.name.length),
      priority: pick(PRIORITIES, i + priority.length),
      project,
      done: status === "done",
      bucket,
    };
  });
}

function buildActiveEpic(index: number): TaskDeliveryRow {
  const epic = pick(ACTIVE_EPICS, index);
  const assignee = pick(TEAM, index);
  const priority = pick(PRIORITIES, index);
  const id = `active-${index + 1}`;
  const subRows = buildSubRows(id, epic.project, assignee, priority, epic.subtasks, "active");
  const openSubs = subRows.filter((s) => s.status !== "done").length;
  const status: TaskStatus = openSubs === 0 ? "done" : "in_progress";

  return {
    id,
    title: epic.title,
    status,
    assignee,
    priority,
    project: epic.project,
    done: status === "done",
    bucket: "active",
    subRows,
  };
}

function buildBacklogTask(index: number): TaskDeliveryRow {
  const assignee = pick(TEAM, index + 3);
  const priority = pick(PRIORITIES, index + 1);
  const project = pick(PROJECTS, index + 2);
  const id = `backlog-${index + 1}`;
  const withSubtasks = index % 4 === 0;
  const subRows = withSubtasks
    ? buildSubRows(
        id,
        project,
        assignee,
        priority,
        [
          pick(DONE_SNIPPETS, index),
          pick(DONE_SNIPPETS, index + 1),
          `Scope ${pick(BACKLOG_TITLES, index).slice(0, 48).toLowerCase()}`,
        ],
        "backlog",
      )
    : undefined;

  return {
    id,
    title: pick(BACKLOG_TITLES, index),
    status: "backlog",
    assignee,
    priority,
    project,
    done: false,
    bucket: "backlog",
    subRows,
  };
}

/** ~20 active epics + ~20 backlog items — realistic delivery board volume. */
export function createTaskDeliveryMockData(): TaskDeliveryRow[] {
  const active = Array.from({ length: ACTIVE_EPICS.length }, (_, i) => buildActiveEpic(i));
  const backlog = Array.from({ length: BACKLOG_TITLES.length }, (_, i) => buildBacklogTask(i));
  return [...active, ...backlog];
}

/** Default expanded rows — first three epics open on load. */
export function defaultTaskDeliveryExpanded(): Record<string, boolean> {
  return { "active-1": true, "active-2": true, "active-3": true };
}
