export interface WorkspaceFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  size?: number;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  blueprint: string;
  status: 'quenched' | 'tempered' | 'forged' | 'draft';
  framework: string;
  language: string;
  packageManager: string;
  previewKind: 'web' | 'static' | 'node';
  previewUrl: string;
  port: number;
  files: WorkspaceFile[];
  createdAt: number;
}

export const INITIAL_WORKSPACES: WorkspaceProject[] = [
  {
    id: 'a-website-for-a-lawncare-16cc0b4d',
    name: "Jake's Lawncare & Services",
    description: 'Professional lawn care website with service showcase, quote requests, and testimonials.',
    blueprint: "Build a modern, responsive website for Jake's Lawncare & Services featuring lawn mowing, aeration, fertilization, customer testimonials, and an appointment booking form.",
    status: 'quenched',
    framework: 'HTML5 / CSS3',
    language: 'JavaScript',
    packageManager: 'npm',
    previewKind: 'static',
    previewUrl: '/workspaces/a-website-for-a-lawncare-16cc0b4d/index.html',
    port: 3000,
    createdAt: Date.now() - 3600000 * 24 * 3,
    files: [
      { path: 'index.html', name: 'index.html', type: 'file', size: 9420 },
      { path: 'styles.css', name: 'styles.css', type: 'file', size: 6810 },
      { path: 'script.js', name: 'script.js', type: 'file', size: 2911 },
      { path: 'opencode.json', name: 'opencode.json', type: 'file', size: 340 },
      { path: 'AGENTS.md', name: 'AGENTS.md', type: 'file', size: 450 },
    ],
  },
  {
    id: 'a-website-for-a-software-3a28369c',
    name: 'Ironclad Systems - Cyber Security',
    description: 'Secure software solutions for the modern enterprise with security audit tools and penetration testing services.',
    blueprint: 'Create an enterprise software company website for Ironclad Systems with security auditing services, products showcase (Shield, SecureVault), and contact form.',
    status: 'quenched',
    framework: 'HTML5 / Modern CSS',
    language: 'JavaScript',
    packageManager: 'npm',
    previewKind: 'static',
    previewUrl: '/workspaces/a-website-for-a-software-3a28369c/index.html',
    port: 3000,
    createdAt: Date.now() - 3600000 * 24 * 2,
    files: [
      { path: 'index.html', name: 'index.html', type: 'file', size: 5280 },
      { path: 'styles.css', name: 'styles.css', type: 'file', size: 4950 },
      { path: 'script.js', name: 'script.js', type: 'file', size: 1475 },
      { path: 'opencode.json', name: 'opencode.json', type: 'file', size: 310 },
      { path: 'AGENTS.md', name: 'AGENTS.md', type: 'file', size: 420 },
    ],
  },
  {
    id: 'a-website-for-a-machinis-8380c076',
    name: 'Onspec Precision Machining',
    description: 'High-precision CNC machining portfolio with material capabilities, tolerance specifications, and quote portal.',
    blueprint: 'A website for a machinist shop called Onspec Precision Machining with CNC capabilities and RFQ form.',
    status: 'quenched',
    framework: 'Static Web / Modular',
    language: 'JavaScript',
    packageManager: 'npm',
    previewKind: 'static',
    previewUrl: '/workspaces/a-website-for-a-machinis-8380c076/src/index.html',
    port: 3000,
    createdAt: Date.now() - 3600000 * 24,
    files: [
      { path: 'src', name: 'src', type: 'directory' },
      { path: 'src/index.html', name: 'index.html', type: 'file', size: 760 },
      { path: 'src/js', name: 'js', type: 'directory' },
      { path: 'src/js/main.js', name: 'main.js', type: 'file', size: 3120 },
      { path: 'src/styles', name: 'styles', type: 'directory' },
      { path: 'src/styles/main.css', name: 'main.css', type: 'file', size: 4200 },
      { path: 'src/pages', name: 'pages', type: 'directory' },
      { path: 'src/pages/home.html', name: 'home.html', type: 'file', size: 3840 },
      { path: 'opencode.json', name: 'opencode.json', type: 'file', size: 280 },
    ],
  },
  {
    id: 'a-website-for-a-software-5f9b2f4d',
    name: 'Ironclad Systems - Cloud & Edge',
    description: 'Scalable cloud infrastructure, software development, and cybersecurity for global enterprises.',
    blueprint: 'Ironclad Systems - modern software solutions with hero section, service cards, and quick contact form.',
    status: 'quenched',
    framework: 'HTML5',
    language: 'JavaScript',
    packageManager: 'npm',
    previewKind: 'static',
    previewUrl: '/workspaces/a-website-for-a-software-5f9b2f4d/index.html',
    port: 3000,
    createdAt: Date.now() - 3600000 * 12,
    files: [
      { path: 'index.html', name: 'index.html', type: 'file', size: 3410 },
      { path: 'styles.css', name: 'styles.css', type: 'file', size: 2980 },
      { path: 'script.js', name: 'script.js', type: 'file', size: 1120 },
      { path: 'README.md', name: 'README.md', type: 'file', size: 850 },
      { path: 'opencode.json', name: 'opencode.json', type: 'file', size: 290 },
    ],
  },
  {
    id: 'create-a-small-node-proj-0c96c6a1',
    name: 'Small Node.js Microservice',
    description: 'Lightweight Node.js microservice architecture with build runner and package management.',
    blueprint: 'Create a small Node.js project with modular structure, scripts, and build verification.',
    status: 'quenched',
    framework: 'Node.js',
    language: 'TypeScript / Node',
    packageManager: 'npm',
    previewKind: 'node',
    previewUrl: '/workspaces/create-a-small-node-proj-0c96c6a1/README.md',
    port: 7171,
    createdAt: Date.now() - 3600000 * 4,
    files: [
      { path: 'package.json', name: 'package.json', type: 'file', size: 450 },
      { path: 'build.mjs', name: 'build.mjs', type: 'file', size: 1200 },
      { path: 'README.md', name: 'README.md', type: 'file', size: 1850 },
      { path: 'opencode.json', name: 'opencode.json', type: 'file', size: 310 },
      { path: 'AGENTS.md', name: 'AGENTS.md', type: 'file', size: 410 },
    ],
  },
];
