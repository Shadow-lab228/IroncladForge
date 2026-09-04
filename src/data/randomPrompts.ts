export interface PromptExample {
  id: string;
  category: string;
  title: string;
  badge: string;
  prompt: string;
}

export const RANDOM_PROMPTS: PromptExample[] = [
  // 1. SaaS
  {
    id: 'saas-crm',
    category: 'SaaS',
    title: 'Enterprise CRM & Deal Pipeline',
    badge: 'SaaS & CRM',
    prompt:
      'Build a modern SaaS CRM application with customer accounts, interactive deal pipeline stages (Lead, Qualified, Demo, Proposal, Won), contact directory with search and tag filtering, real-time revenue telemetry, and deal creation modal.',
  },
  {
    id: 'saas-billing',
    category: 'SaaS',
    title: 'Subscription & Invoicing Portal',
    badge: 'Fintech SaaS',
    prompt:
      'Create a SaaS billing and subscription portal with tier plan selection (Starter, Pro, Enterprise), interactive usage meters, invoice download history, credit card payment form with validation, and auto-renewal toggle controls.',
  },
  // 2. Dashboards
  {
    id: 'dash-analytics',
    category: 'Dashboards',
    title: 'Executive Telemetry & Cohort Dashboard',
    badge: 'Analytics',
    prompt:
      'Build a modern analytics dashboard with high-contrast dark theme, live telemetry metric cards (ARR, Churn, Active Users, LTV), date range filtering (7d, 30d, 90d), interactive cohort retention table, and conversion funnel breakdown.',
  },
  {
    id: 'dash-infra',
    category: 'Dashboards',
    title: 'Cloud Infrastructure & Kubernetes Monitor',
    badge: 'DevOps',
    prompt:
      'Design a cloud infrastructure monitoring dashboard showing cluster health status, CPU/Memory telemetry sparklines, pod restart logs, node geography map, and instant alert threshold toggles.',
  },
  // 3. Developer Tools
  {
    id: 'dev-api-client',
    category: 'Developer Tools',
    title: 'REST & GraphQL API Studio',
    badge: 'DevTools',
    prompt:
      'Build a fast in-browser API testing studio featuring HTTP method selection (GET, POST, PUT, DELETE), header key-value editors, JSON body formatter, response status latency inspector, and saved request collections.',
  },
  {
    id: 'dev-regex-sandbox',
    category: 'Developer Tools',
    title: 'Regex & Schema Validator Workbench',
    badge: 'DevTools',
    prompt:
      'Create an interactive regular expression test workbench with real-time match highlighting, regex flag toggles (g, i, m), regex library presets (Email, URL, Semver, IP), and explain-syntax inspector.',
  },
  // 4. E-Commerce
  {
    id: 'ecom-marketplace',
    category: 'E-commerce',
    title: 'Artisan Hardware & Specialty Store',
    badge: 'E-Commerce',
    prompt:
      'Build a responsive e-commerce storefront with product catalog grid, multi-faceted filtering (category, price range, in-stock), product detail quick-view modal, slide-out shopping cart drawer with quantity steppers, and multi-step checkout review.',
  },
  {
    id: 'ecom-digital-goods',
    category: 'E-commerce',
    title: 'Digital Asset & Plugin Marketplace',
    badge: 'Marketplace',
    prompt:
      'Create a digital creator marketplace for UI kits, audio presets, and code templates with instant search, star rating reviews, live preview player, creator profile badges, and license tier selector.',
  },
  // 5. Productivity
  {
    id: 'prod-notes-canvas',
    category: 'Productivity',
    title: 'Markdown Knowledge Graph & Scratchpad',
    badge: 'Productivity',
    prompt:
      'Build a minimalist personal knowledge base with Markdown editor, split-screen preview, tag indexing, fast full-text search, pinned scratchpad drawer, and instant export to JSON/Markdown.',
  },
  {
    id: 'prod-time-tracker',
    category: 'Productivity',
    title: 'Sprint Stopwatch & Billable Hours Log',
    badge: 'Productivity',
    prompt:
      'Develop a precision time-tracking application for consultants with start/stop timer, client and project assignment, billable rate calculator, weekly timesheet view, and CSV export for invoicing.',
  },
  // 6. CRM
  {
    id: 'crm-real-estate',
    category: 'CRM',
    title: 'Commercial Property & Client CRM',
    badge: 'Real Estate CRM',
    prompt:
      'Build a commercial real estate CRM featuring property listings catalog with square footage filters, client inquiry inbox, scheduled walkthrough calendar, and agent commission calculator.',
  },
  // 7. Analytics
  {
    id: 'analytics-marketing',
    category: 'Analytics',
    title: 'Omnichannel Ad Campaign Attribution',
    badge: 'Growth Analytics',
    prompt:
      'Create a marketing attribution dashboard comparing Google Ads, Meta, and Organic traffic with CAC, ROAS, click-through percentages, visual conversion waterfall, and budget pacing indicators.',
  },
  // 8. Documentation
  {
    id: 'doc-api-portal',
    category: 'Documentation',
    title: 'Interactive Developer Documentation Hub',
    badge: 'Docs',
    prompt:
      'Build a developer documentation site with hierarchical sidebar navigation, searchable API endpoint explorer with copyable cURL/TypeScript snippets, parameter tables, and dark/light theme switch.',
  },
  // 9. Education
  {
    id: 'edu-code-academy',
    category: 'Education',
    title: 'Interactive Algorithms Learning Portal',
    badge: 'Education',
    prompt:
      'Develop an interactive computer science learning portal with step-by-step sorting algorithm visualizer, complexity comparison charts (Big-O), interactive quizzes, and course progress completion tracking.',
  },
  // 10. Project Management
  {
    id: 'pm-kanban-board',
    category: 'Project Management',
    title: 'Agile Kanban Board & Sprint Tracker',
    badge: 'Project Management',
    prompt:
      'Build an Agile Kanban project management tool with customizable workflow columns (Backlog, In Progress, Code Review, Done), drag-and-drop task cards with priority badges, assignee avatars, and sprint burn-down summary.',
  },
  {
    id: 'pm-roadmap',
    category: 'Project Management',
    title: 'Strategic Product Roadmap & Gantt Matrix',
    badge: 'Product Strategy',
    prompt:
      'Create an enterprise product roadmap viewer with quarterly timeline swimlanes (Q1-Q4), milestone dependencies, team velocity tracking, and feature status filter (Committed, Proposed, In Flight).',
  },
  // 11. AI Applications
  {
    id: 'ai-prompt-studio',
    category: 'AI Applications',
    title: 'Multi-Model Prompt Engineering Workbench',
    badge: 'AI Studio',
    prompt:
      'Build an AI prompt experimentation studio with side-by-side model comparison, temperature and top-p parameter sliders, token counter, variable template interpolation ({{input}}), and test history log.',
  },
  {
    id: 'ai-doc-qa',
    category: 'AI Applications',
    title: 'Contextual Document Assistant & Inspector',
    badge: 'AI Knowledge',
    prompt:
      'Develop an AI document analysis workbench with file upload dropzone, semantic chunking inspector, conversational question-answering feed with cited source highlight references, and confidence ratings.',
  },
  // 12. Business Applications
  {
    id: 'biz-inventory-erp',
    category: 'Business Applications',
    title: 'Warehouse Inventory & Purchase Order ERP',
    badge: 'Operations',
    prompt:
      'Build an inventory management system with SKU barcode search, low-stock threshold alerts, supplier directory, purchase order status flow (Draft, Sent, Received), and reorder quantity suggestion engine.',
  },
  {
    id: 'biz-fleet-logistics',
    category: 'Business Applications',
    title: 'Fleet Dispatch & Delivery Tracking',
    badge: 'Logistics',
    prompt:
      'Create a fleet logistics dispatch console with vehicle status cards (In Transit, Idling, Maintenance), delivery route list, fuel efficiency metric telemetry, and instant dispatch assignment modal.',
  },
  // 13. Portfolio Sites
  {
    id: 'portfolio-systems-engineer',
    category: 'Portfolio Sites',
    title: 'Staff Systems Architect Interactive Portfolio',
    badge: 'Portfolio',
    prompt:
      'Build an interactive portfolio for a senior systems architect featuring high-contrast typography, interactive system architecture diagrams, case study deep-dives with performance benchmarks, and terminal-inspired contact form.',
  },
  // 14. Marketplaces
  {
    id: 'marketplace-freelance',
    category: 'Marketplaces',
    title: 'Vetted Engineering Talent Marketplace',
    badge: 'Talent Marketplace',
    prompt:
      'Build a two-sided talent marketplace with engineer profiles showcasing skill badges, hourly rates, client ratings, instant search with availability filters, and project proposal submission drawer.',
  },
];

export function getRandomPrompt(excludeId?: string): PromptExample {
  const filtered = excludeId
    ? RANDOM_PROMPTS.filter((p) => p.id !== excludeId)
    : RANDOM_PROMPTS;
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index];
}

export function getRandomPromptByCategory(category: string, excludeId?: string): PromptExample {
  const matching = RANDOM_PROMPTS.filter((p) =>
    category === 'All' ? true : p.category.toLowerCase() === category.toLowerCase()
  );
  const filtered = excludeId && matching.length > 1
    ? matching.filter((p) => p.id !== excludeId)
    : matching;
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index] || RANDOM_PROMPTS[0];
}
