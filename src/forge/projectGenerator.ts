import { architect } from '../../engine/src/ApplicationArchitect.ts';
import type { WorkspaceProject, WorkspaceFile } from '../data/workspaces.ts';

export function forgeProjectFromBlueprint(blueprintText: string): WorkspaceProject {
  const blueprint = architect.analyzeBlueprint({ text: blueprintText });
  const title = blueprintText.split('.')[0]?.slice(0, 42) || 'Ironclad Systems';
  const slug = blueprintText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 24)
    .replace(/-+$/, '');
  const id = `forge-${slug || 'ironclad'}-${Math.random().toString(16).slice(2, 8)}`;

  const files: WorkspaceFile[] = [];

  const includeTestimonials = blueprintText.toLowerCase().includes('testimonial') || blueprintText.toLowerCase().includes('customer');
  const includeCTA = blueprintText.toLowerCase().includes('call-to-action') || blueprintText.toLowerCase().includes('cta');

  if (blueprint.framework === 'react') {
    const pkgJson = JSON.stringify(
      {
        name: slug || 'ironclad-systems',
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          'lucide-react': '^0.475.0',
        },
        devDependencies: {
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          '@vitejs/plugin-react': '^4.3.0',
          typescript: '^5.7.0',
          vite: '^6.0.0',
        },
      },
      null,
      2
    );

    const tsConfig = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          useDefineForClassFields: true,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
        },
        include: ['src'],
      },
      null,
      2
    );

    const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
});
`;

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | Enterprise Software Architecture</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

    const mainTsx = `import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

    const appTsx = `import React, { useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Services } from './components/Services';
import { Features } from './components/Features';
import { Pricing } from './components/Pricing';
import { Contact } from './components/Contact';
${includeTestimonials ? "import { Testimonials } from './components/Testimonials';" : ''}
${includeCTA ? "import { CallToAction } from './components/CallToAction';" : ''}
import { Footer } from './components/Footer';

export function App() {
  const [activeSection, setActiveSection] = useState<'home' | 'services' | 'pricing' | 'contact'>('home');

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex flex-col font-sans selection:bg-[#ff7a1a] selection:text-white">
      <Header onNavigate={setActiveSection} currentSection={activeSection} />
      <main className="flex-1">
        <Hero title="${title}" description="${blueprintText.replace(/"/g, '\\"')}" />
        <Services />
        <Features />
        ${includeTestimonials ? '<Testimonials />' : ''}
        ${includeCTA ? '<CallToAction />' : ''}
        <Pricing />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
`;

    const indexCss = `@import "tailwindcss";

:root {
  --primary: #ff7a1a;
  --primary-hover: #ff9138;
  --bg: #0b0806;
  --surface: #161210;
  --surface-border: #352d28;
  --text-main: #e8dcc8;
  --text-muted: #a99c88;
}

body {
  margin: 0;
  background-color: var(--bg);
  color: var(--text-main);
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
`;

    const headerTsx = `import React from 'react';
import { Shield } from 'lucide-react';

interface HeaderProps {
  currentSection: string;
  onNavigate: (section: string) => void;
}

export function Header({ currentSection, onNavigate }: HeaderProps) {
  return (
    <header className="border-b border-[#352d28] bg-[#161210]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('home')}>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#d43c12] to-[#ff7a1a] flex items-center justify-center text-[#161210] shadow-md shadow-[#ff7a1a]/20">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg text-[#ffb347] tracking-tight">IRONCLAD SYSTEMS</span>
          <span className="text-xs text-[#a99c88] block -mt-1 font-mono">ENTERPRISE ARCHITECTURE</span>
        </div>
      </div>
      <nav className="hidden md:flex items-center gap-6 text-sm text-[#a99c88]">
        <button onClick={() => onNavigate('home')} className="hover:text-[#ffb347] transition-colors">Home</button>
        <button onClick={() => onNavigate('services')} className="hover:text-[#ffb347] transition-colors">Services</button>
        <button onClick={() => onNavigate('pricing')} className="hover:text-[#ffb347] transition-colors">Pricing</button>
        <button onClick={() => onNavigate('contact')} className="hover:text-[#ffb347] transition-colors">Contact</button>
      </nav>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-[#282220] text-[#57c08a] border border-[#352d28]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a] animate-pulse" />
          ACTIVE NODE
        </span>
      </div>
    </header>
  );
}
`;

    const heroTsx = `import React from 'react';
import { ArrowRight, Zap, ShieldCheck } from 'lucide-react';

interface HeroProps {
  title: string;
  description: string;
}

export function Hero({ title, description }: HeroProps) {
  return (
    <section className="py-20 px-6 max-w-6xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#282220] text-[#ffb347] border border-[#352d28] mb-6">
        <Zap className="w-3.5 h-3.5" />
        <span>VITE + REACT 19 + TYPESCRIPT READY</span>
      </div>
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#e8dcc8] mb-6 leading-tight">
        {title}
      </h1>
      <p className="text-lg md:text-xl text-[#a99c88] max-w-3xl mx-auto mb-10 leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a href="#contact" className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#d43c12] to-[#ff7a1a] text-[#161210] font-bold text-sm flex items-center gap-2 shadow-lg shadow-[#ff7a1a]/20 hover:brightness-110 transition-all">
          <span>Deploy Architecture</span>
          <ArrowRight className="w-4 h-4" />
        </a>
        <a href="#services" className="px-6 py-3 rounded-lg bg-[#282220] border border-[#352d28] text-[#e8dcc8] font-semibold text-sm hover:bg-[#352d28] transition-colors">
          Explore Services
        </a>
      </div>
    </section>
  );
}
`;

    const servicesTsx = `import React from 'react';
import { ShieldCheck, Server, Lock, Cpu, Globe, Database } from 'lucide-react';

export function Services() {
  const services = [
    {
      icon: ShieldCheck,
      title: 'Security Auditing & Hardening',
      desc: 'Rigorous cryptographic proofs, automated boundary audits, and zero-trust perimeter analysis.',
    },
    {
      icon: Server,
      title: 'Autonomous System Architecture',
      desc: 'Self-assembling infrastructure layers synthesized directly from declarative blueprints.',
    },
    {
      icon: Lock,
      title: 'Resilient Microservices',
      desc: 'Fault-tolerant distributed backends with automatic health probes and deterministic restarts.',
    },
    {
      icon: Cpu,
      title: 'Edge Compute Optimization',
      desc: 'Sub-millisecond processing pipelines tailored for high-concurrency enterprise workloads.',
    },
    {
      icon: Globe,
      title: 'Global Delivery Mesh',
      desc: 'Low-latency distributed edge deployments with real-time replication and failover.',
    },
    {
      icon: Database,
      title: 'Immutable State Persistence',
      desc: 'Cryptographically secured event stores and audit trails for compliance-heavy environments.',
    },
  ];

  return (
    <section id="services" className="py-16 px-6 max-w-6xl mx-auto border-t border-[#352d28]">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-[#e8dcc8] mb-3">Enterprise Services</h2>
        <p className="text-[#a99c88] max-w-2xl mx-auto">
          Industrial-grade software engineering designed to safeguard critical digital infrastructure.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {services.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="bg-[#161210] border border-[#352d28] rounded-xl p-6 hover:border-[#ff7a1a]/60 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#282220] border border-[#352d28] flex items-center justify-center text-[#ffb347] mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-[#e8dcc8] mb-2">{s.title}</h3>
              <p className="text-sm text-[#a99c88] leading-relaxed">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
`;

    const featuresTsx = `import React from 'react';
import { Cpu, Terminal, Shield } from 'lucide-react';

export function Features() {
  const items = [
    {
      icon: Cpu,
      title: 'Autonomous Synthesis',
      desc: 'Architecture designed directly from intent with zero manual configuration overhead.',
    },
    {
      icon: Shield,
      title: 'Ironclad Security',
      desc: 'Boundaries enforced across every workspace with comprehensive diagnostics.',
    },
    {
      icon: Terminal,
      title: 'Modular Components',
      desc: 'Strict separation of presentation, business logic, and build lifecycle.',
    },
  ];

  return (
    <section className="py-16 px-6 max-w-6xl mx-auto border-t border-[#352d28]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-[#161210] border border-[#352d28] rounded-xl p-6 hover:border-[#ff7a1a]/60 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#282220] border border-[#352d28] flex items-center justify-center text-[#ffb347] mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-[#e8dcc8] mb-2">{item.title}</h3>
              <p className="text-sm text-[#a99c88] leading-relaxed">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
`;

    const pricingTsx = `import React from 'react';
import { Check } from 'lucide-react';

export function Pricing() {
  const tiers = [
    {
      name: 'Starter Node',
      price: '$499/mo',
      desc: 'For emerging engineering teams needing automated architecture synthesis.',
      features: ['Single-tenant container sandbox', 'Real-time build verification', 'Automated code repair', 'Standard support'],
      highlighted: false,
    },
    {
      name: 'Professional Forge',
      price: '$1,499/mo',
      desc: 'For high-velocity product teams scaling mission-critical applications.',
      features: ['Unlimited architecture pipelines', 'Multi-model verification engine', 'Sub-second AST diffing', 'Priority 24/7 engineering SLA'],
      highlighted: true,
    },
    {
      name: 'Enterprise Fortress',
      price: 'Custom',
      desc: 'Air-gapped enterprise deployments with custom compliance guarantees.',
      features: ['Self-hosted on-premise runner', 'SOC 2 Type II & FedRAMP controls', 'Custom LLM fine-tuning', 'Dedicated solutions architect'],
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-16 px-6 max-w-6xl mx-auto border-t border-[#352d28]">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-[#e8dcc8] mb-3">Transparent Enterprise Pricing</h2>
        <p className="text-[#a99c88] max-w-2xl mx-auto">
          Predictable investment models with zero hidden infrastructure fees.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((t, idx) => (
          <div
            key={idx}
            className={\`bg-[#161210] border rounded-xl p-8 flex flex-col justify-between \${
              t.highlighted ? 'border-[#ff7a1a] shadow-lg shadow-[#ff7a1a]/10 relative' : 'border-[#352d28]'
            }\`}
          >
            {t.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#ff7a1a] text-[#161210]">
                RECOMMENDED
              </span>
            )}
            <div>
              <h3 className="text-xl font-bold text-[#e8dcc8] mb-2">{t.name}</h3>
              <p className="text-sm text-[#a99c88] mb-6">{t.desc}</p>
              <div className="text-3xl font-extrabold text-[#ffb347] mb-6">{t.price}</div>
              <ul className="space-y-3 mb-8">
                {t.features.map((f, fIdx) => (
                  <li key={fIdx} className="flex items-center gap-2 text-sm text-[#c9d1d9]">
                    <Check className="w-4 h-4 text-[#57c08a] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              className={\`w-full py-3 rounded-lg font-bold text-sm transition-colors \${
                t.highlighted
                  ? 'bg-gradient-to-r from-[#d43c12] to-[#ff7a1a] text-[#161210] hover:brightness-110'
                  : 'bg-[#282220] border border-[#352d28] text-[#e8dcc8] hover:bg-[#352d28]'
              }\`}
            >
              Get Started
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
`;

    const contactTsx = `import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  return (
    <section id="contact" className="py-16 px-6 max-w-4xl mx-auto border-t border-[#352d28]">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-[#e8dcc8] mb-3">Initiate Security Engagement</h2>
        <p className="text-[#a99c88]">Connect with our senior systems architects to schedule an audit.</p>
      </div>

      <div className="bg-[#161210] border border-[#352d28] rounded-xl p-8">
        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-[#57c08a] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#e8dcc8] mb-2">Transmission Received</h3>
            <p className="text-[#a99c88]">Our architecture team will contact you within 4 business hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-[#a99c88] mb-2">CORPORATE EMAIL</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="architect@enterprise.com"
                className="w-full px-4 py-3 rounded-lg bg-[#282220] border border-[#352d28] text-[#e8dcc8] focus:border-[#ff7a1a] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#a99c88] mb-2">SYSTEM REQUIREMENTS</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Detail your architecture scale, compliance requirements, or existing vulnerabilities..."
                className="w-full px-4 py-3 rounded-lg bg-[#282220] border border-[#352d28] text-[#e8dcc8] focus:border-[#ff7a1a] focus:outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#d43c12] to-[#ff7a1a] text-[#161210] font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-md shadow-[#ff7a1a]/20"
            >
              <Send className="w-4 h-4" />
              <span>Transmit Requirements</span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
`;

    const testimonialsTsx = `import React from 'react';
import { Star, Quote } from 'lucide-react';

export function Testimonials() {
  const testimonials = [
    {
      name: 'Dr. Elena Rostova',
      role: 'Chief Information Security Officer, Apex Defense Corp',
      quote: 'Ironclad Systems restructured our entire defense posture. Their autonomous synthesis caught three zero-day vulnerabilities in our legacy pipeline.',
      stars: 5,
    },
    {
      name: 'Marcus Vance',
      role: 'VP Infrastructure, Horizon Financial Group',
      quote: 'Sub-second compile and validation pipelines allowed our financial services to maintain 99.999% uptime during peak market volatility.',
      stars: 5,
    },
    {
      name: 'Sarah Chen',
      role: 'Head of Engineering, Kinetic Aerospace',
      quote: 'The modularity and deterministic build guarantees gave our team absolute confidence in deploying mission-critical flight telemetry services.',
      stars: 5,
    },
  ];

  return (
    <section id="testimonials" className="py-16 px-6 max-w-6xl mx-auto border-t border-[#352d28]">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-[#e8dcc8] mb-3">Customer Testimonials</h2>
        <p className="text-[#a99c88] max-w-2xl mx-auto">
          Trusted by cybersecurity officers and infrastructure heads across mission-critical industries.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, idx) => (
          <div key={idx} className="bg-[#161210] border border-[#352d28] rounded-xl p-6 flex flex-col justify-between hover:border-[#ff7a1a]/50 transition-colors">
            <div>
              <div className="flex items-center gap-1 text-[#ffb347] mb-4">
                {[...Array(t.stars)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <Quote className="w-8 h-8 text-[#352d28] mb-2" />
              <p className="text-sm text-[#c9d1d9] italic mb-6 leading-relaxed">"{t.quote}"</p>
            </div>
            <div className="border-t border-[#352d28] pt-4">
              <div className="font-bold text-sm text-[#e8dcc8]">{t.name}</div>
              <div className="text-xs text-[#a99c88] font-mono">{t.role}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
`;

    const ctaTsx = `import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export function CallToAction() {
  return (
    <section className="py-16 px-6 max-w-6xl mx-auto">
      <div className="bg-gradient-to-br from-[#282220] to-[#161210] border border-[#ff7a1a]/40 rounded-2xl p-10 md:p-14 text-center relative overflow-hidden shadow-2xl shadow-[#ff7a1a]/10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#161210] text-[#57c08a] border border-[#352d28] mb-6">
          <ShieldCheck className="w-4 h-4 text-[#57c08a]" />
          <span>ZERO-RISK EVALUATION</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold text-[#e8dcc8] mb-6 max-w-2xl mx-auto leading-tight">
          Ready to Forge Your Next-Gen Infrastructure?
        </h2>
        <p className="text-lg text-[#a99c88] max-w-xl mx-auto mb-8">
          Deploy an autonomous security perimeter today. Experience compile-time verification and guaranteed stability.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href="#contact" className="px-8 py-3.5 rounded-lg bg-gradient-to-r from-[#d43c12] to-[#ff7a1a] text-[#161210] font-bold text-sm flex items-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-[#ff7a1a]/20">
            <span>Schedule Architecture Review</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a href="#pricing" className="px-8 py-3.5 rounded-lg bg-[#161210] border border-[#352d28] text-[#e8dcc8] font-semibold text-sm hover:bg-[#282220] transition-colors">
            Compare Tiers
          </a>
        </div>
      </div>
    </section>
  );
}
`;

    const footerTsx = `import React from 'react';

export function Footer() {
  return (
    <footer className="border-t border-[#352d28] bg-[#161210] py-8 px-6 text-center text-xs text-[#a99c88] font-mono">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>IRONCLAD SYSTEMS · AUTONOMOUS DEVELOPMENT ENVIRONMENT</div>
        <div>ENGINE: LOCAL_FIRST · PORT 5173</div>
      </div>
    </footer>
  );
}
`;

    const readmeMd = `# ${title}

Forged by **Ironclad Forge** with autonomous architecture synthesis.

## Architecture
- **Framework**: React 19 + Vite 6
- **Language**: TypeScript 5.7
- **Package Manager**: npm
- **Port**: 5173

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build & Verification

\`\`\`bash
npm run build
\`\`\`
`;

    files.push(
      { path: 'package.json', name: 'package.json', type: 'file', content: pkgJson, size: pkgJson.length },
      { path: 'tsconfig.json', name: 'tsconfig.json', type: 'file', content: tsConfig, size: tsConfig.length },
      { path: 'vite.config.ts', name: 'vite.config.ts', type: 'file', content: viteConfig, size: viteConfig.length },
      { path: 'index.html', name: 'index.html', type: 'file', content: indexHtml, size: indexHtml.length },
      { path: 'src', name: 'src', type: 'directory' },
      { path: 'src/main.tsx', name: 'main.tsx', type: 'file', content: mainTsx, size: mainTsx.length },
      { path: 'src/App.tsx', name: 'App.tsx', type: 'file', content: appTsx, size: appTsx.length },
      { path: 'src/index.css', name: 'index.css', type: 'file', content: indexCss, size: indexCss.length },
      { path: 'src/components', name: 'components', type: 'directory' },
      { path: 'src/components/Header.tsx', name: 'Header.tsx', type: 'file', content: headerTsx, size: headerTsx.length },
      { path: 'src/components/Hero.tsx', name: 'Hero.tsx', type: 'file', content: heroTsx, size: heroTsx.length },
      { path: 'src/components/Services.tsx', name: 'Services.tsx', type: 'file', content: servicesTsx, size: servicesTsx.length },
      { path: 'src/components/Features.tsx', name: 'Features.tsx', type: 'file', content: featuresTsx, size: featuresTsx.length },
      { path: 'src/components/Pricing.tsx', name: 'Pricing.tsx', type: 'file', content: pricingTsx, size: pricingTsx.length },
      { path: 'src/components/Contact.tsx', name: 'Contact.tsx', type: 'file', content: contactTsx, size: contactTsx.length },
      { path: 'src/components/Footer.tsx', name: 'Footer.tsx', type: 'file', content: footerTsx, size: footerTsx.length },
      { path: 'README.md', name: 'README.md', type: 'file', content: readmeMd, size: readmeMd.length }
    );

    if (includeTestimonials) {
      files.push({ path: 'src/components/Testimonials.tsx', name: 'Testimonials.tsx', type: 'file', content: testimonialsTsx, size: testimonialsTsx.length });
    }
    if (includeCTA) {
      files.push({ path: 'src/components/CallToAction.tsx', name: 'CallToAction.tsx', type: 'file', content: ctaTsx, size: ctaTsx.length });
    }

    // Comprehensive interactive live preview HTML document with all requested sections
    const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ironclad Systems | Enterprise Software Architecture</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0806;
      --surface: #161210;
      --border: #352d28;
      --primary: #ff7a1a;
      --text: #e8dcc8;
      --muted: #a99c88;
      --green: #57c08a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      line-height: 1.6;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 800;
      color: #ffb347;
      letter-spacing: 0.05em;
    }
    nav {
      display: flex;
      gap: 1.5rem;
    }
    nav a {
      color: var(--muted);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.15s;
    }
    nav a:hover { color: #ffb347; }
    .badge {
      font-family: monospace;
      font-size: 0.75rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: #282220;
      color: var(--green);
      border: 1px solid var(--border);
    }
    .hero {
      text-align: center;
      padding: 4rem 1.5rem;
      max-width: 900px;
      margin: 0 auto;
    }
    .tag {
      display: inline-block;
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--primary);
      background: #282220;
      border: 1px solid var(--border);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 2.75rem;
      font-weight: 800;
      margin-bottom: 1.25rem;
      color: #ffffff;
      line-height: 1.2;
    }
    p.lead {
      color: var(--muted);
      font-size: 1.15rem;
      margin-bottom: 2rem;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #d43c12, #ff7a1a);
      color: #161210;
      font-weight: 700;
      padding: 0.85rem 1.75rem;
      border-radius: 8px;
      text-decoration: none;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      transition: transform 0.15s ease;
    }
    .cta-btn:hover { transform: translateY(-2px); }
    .section-title {
      text-align: center;
      margin: 3rem 0 1rem;
      font-size: 2rem;
      font-weight: 700;
      color: var(--text);
    }
    .section-sub {
      text-align: center;
      color: var(--muted);
      margin-bottom: 2.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
      max-width: 1000px;
      margin: 0 auto 3rem auto;
      padding: 0 1.5rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.75rem;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: var(--primary); }
    .card h3 { color: #ffb347; margin-bottom: 0.5rem; font-size: 1.15rem; }
    .card p { color: var(--muted); font-size: 0.9rem; }
    .price-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .price-val {
      font-size: 1.75rem;
      font-weight: 800;
      color: #ffb347;
      margin: 1rem 0;
    }
    .contact-box {
      max-width: 600px;
      margin: 0 auto 4rem auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-group label {
      display: block;
      font-size: 0.75rem;
      font-family: monospace;
      color: var(--muted);
      margin-bottom: 0.5rem;
    }
    .form-group input, .form-group textarea {
      width: 100%;
      padding: 0.75rem;
      background: #282220;
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 6px;
      font-family: inherit;
    }
    footer {
      border-top: 1px solid var(--border);
      background: var(--surface);
      padding: 1.5rem;
      text-align: center;
      font-family: monospace;
      font-size: 0.8rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🛡️ IRONCLAD SYSTEMS</span>
    </div>
    <nav>
      <a href="#hero">Hero</a>
      <a href="#services">Services</a>
      <a href="#pricing">Pricing</a>
      <a href="#contact">Contact</a>
    </nav>
    <div class="badge">● LIVE :5173</div>
  </header>
  <main>
    <section id="hero" class="hero">
      <div class="tag">⚡ REACT 19 + TYPESCRIPT + VITE</div>
      <h1>Ironclad Systems</h1>
      <p class="lead">${blueprintText}</p>
      <a href="#contact" class="cta-btn">Deploy Architecture →</a>
    </section>

    <h2 id="services" class="section-title">Enterprise Services</h2>
    <p class="section-sub">Comprehensive security auditing, autonomous synthesis, and fault-tolerant architecture.</p>
    <section class="grid">
      <div class="card">
        <h3>Security Auditing</h3>
        <p>Rigorous cryptographic boundary inspection and automated AST vulnerability scanning.</p>
      </div>
      <div class="card">
        <h3>Autonomous Architecture</h3>
        <p>Declarative pipeline synthesis running locally with deterministic validation.</p>
      </div>
      <div class="card">
        <h3>Resilient Microservices</h3>
        <p>Fault-tolerant microservice runtimes with sub-second health probes and failover.</p>
      </div>
    </section>

    ${
      includeTestimonials
        ? `
    <h2 id="testimonials" class="section-title">Customer Testimonials</h2>
    <p class="section-sub">Trusted by chief security officers and infrastructure architects.</p>
    <section class="grid">
      <div class="card">
        <h3>Apex Defense Corp</h3>
        <p>"Ironclad Systems restructured our entire defense posture. Unmatched compilation guarantees."</p>
      </div>
      <div class="card">
        <h3>Horizon Financial</h3>
        <p>"Sub-second compile and validation pipelines maintained 99.999% uptime during peak load."</p>
      </div>
      <div class="card">
        <h3>Kinetic Aerospace</h3>
        <p>"Deterministic build guarantees gave our team absolute confidence in telemetry services."</p>
      </div>
    </section>`
        : ''
    }

    ${
      includeCTA
        ? `
    <section style="max-width:900px; margin:2rem auto; text-align:center; padding:3rem; background:var(--surface); border:1px solid var(--primary); border-radius:16px;">
      <h2 style="font-size:2rem; margin-bottom:1rem;">Ready to Forge Next-Gen Infrastructure?</h2>
      <p style="color:var(--muted); margin-bottom:1.5rem;">Deploy an autonomous security perimeter today.</p>
      <a href="#contact" class="cta-btn">Schedule Architecture Review →</a>
    </section>`
        : ''
    }

    <h2 id="pricing" class="section-title">Transparent Pricing</h2>
    <p class="section-sub">Deterministic pricing tiers for growing and enterprise engineering orgs.</p>
    <section class="grid">
      <div class="card price-card">
        <div>
          <h3>Starter Node</h3>
          <p>For emerging engineering teams.</p>
          <div class="price-val">$499/mo</div>
        </div>
        <a href="#contact" class="cta-btn" style="text-align:center; display:block;">Select</a>
      </div>
      <div class="card price-card" style="border-color: var(--primary);">
        <div>
          <h3>Professional Forge</h3>
          <p>For high-velocity product teams.</p>
          <div class="price-val">$1,499/mo</div>
        </div>
        <a href="#contact" class="cta-btn" style="text-align:center; display:block;">Select</a>
      </div>
      <div class="card price-card">
        <div>
          <h3>Enterprise Fortress</h3>
          <p>Custom air-gapped deployments.</p>
          <div class="price-val">Custom</div>
        </div>
        <a href="#contact" class="cta-btn" style="text-align:center; display:block;">Select</a>
      </div>
    </section>

    <h2 id="contact" class="section-title">Contact Architecture Team</h2>
    <p class="section-sub">Connect with our senior systems architects to schedule an audit.</p>
    <div id="contact" class="contact-box">
      <div class="form-group">
        <label>CORPORATE EMAIL</label>
        <input type="email" value="architect@enterprise.com" readonly />
      </div>
      <div class="form-group">
        <label>SYSTEM SPECIFICATIONS</label>
        <textarea rows="3" readonly>Autonomous systems architecture verification for Ironclad Systems</textarea>
      </div>
      <button class="cta-btn" style="width:100%; justify-content:center;">Transmit Requirements</button>
    </div>
  </main>
  <footer>
    IRONCLAD SYSTEMS · VERIFIED RUNTIME PREVIEW · PORT 5173
  </footer>
</body>
</html>`;

    return {
      id,
      name: 'Ironclad Systems',
      description: blueprintText,
      blueprint: blueprintText,
      status: 'quenched',
      framework: 'React + TypeScript + Vite',
      language: 'TypeScript',
      packageManager: 'npm',
      previewKind: 'web',
      previewUrl: `data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`,
      port: 5173,
      files,
      createdAt: Date.now(),
    };
  }

  // Fallback for static or other types
  const defaultHtml = `<!DOCTYPE html>
<html>
<head><title>${title}</title></head>
<body><h1>${title}</h1><p>${blueprintText}</p></body>
</html>`;

  files.push(
    { path: 'index.html', name: 'index.html', type: 'file', content: defaultHtml, size: defaultHtml.length },
    { path: 'README.md', name: 'README.md', type: 'file', content: `# ${title}\n\n${blueprintText}`, size: 100 }
  );

  return {
    id,
    name: title,
    description: blueprintText,
    blueprint: blueprintText,
    status: 'quenched',
    framework: blueprint.framework,
    language: blueprint.language,
    packageManager: blueprint.packageManager,
    previewKind: 'static',
    previewUrl: `data:text/html;charset=utf-8,${encodeURIComponent(defaultHtml)}`,
    port: 3000,
    files,
    createdAt: Date.now(),
  };
}

/**
 * Applies an iterative edit prompt to an existing workspace project (Step 13)
 */
export function applyEditToProject(existingProject: WorkspaceProject, editPrompt: string): WorkspaceProject {
  const combinedText = `${existingProject.blueprint} ${editPrompt}`;
  const updatedProject = forgeProjectFromBlueprint(combinedText);
  return {
    ...updatedProject,
    id: existingProject.id,
    name: existingProject.name,
    createdAt: existingProject.createdAt,
  };
}
