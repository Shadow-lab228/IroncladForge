import { ProjectBlueprint } from './ProjectBlueprint.ts';

export type ArchitectureAnalysis = {
  framework: string;
  approach: string;
  patterns: string[];
  components: string[];
};

/**
 * The ApplicationArchitect - analyzes requirement blueprints and determines 
 * appropriate architectural approach, framework selection, and technology stack.
 */
export class ApplicationArchitect {
  private cache: Map<string, ProjectBlueprint> = new Map();
  private cacheStats: { hits: number; misses: number } = { hits: 0, misses: 0 };
  
  /**
   * Analyze a project blueprint and return an architecture decision
   * 
   * @param blueprint The user's requirement specification
   * @returns A structured ProjectBlueprint with architectural choices
   */
  analyzeBlueprint(blueprint: { text: string }): ProjectBlueprint {
    // Check cache first
    const cacheKey = blueprint.text.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.cache.get(cacheKey)!;
    }
    
    this.cacheStats.misses++;
    
    // Extract requirements from the blueprint text  
    const text = blueprint.text.toLowerCase();
    
    // Determine approach and framework based on keywords
    let approach: 'monolith' | 'microservice' | 'component-based' | 'serverless' = 'monolith';
    let framework: 'react' | 'next' | 'expo' | 'node' | 'vite' | 'static-web' = 'react';
    let type: 'web' | 'mobile' | 'backend' | 'fullstack' | 'static-web' = 'web';
    let language: 'typescript' | 'javascript' = 'typescript';
    let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' = 'npm';
    let runtime: 'node' | 'web' | 'expo-web' = 'web';
    
    // Analyze the requirements to determine architecture
    if (text.includes('mobile') || text.includes('app')) {
      framework = 'expo';
      type = 'mobile';
      runtime = 'expo-web';
      approach = 'component-based';
    } else if (text.includes('backend') || text.includes('server')) {
      framework = 'node';
      type = 'backend';
      runtime = 'node';
      approach = 'microservice';
    } else if (text.includes('full-stack') || text.includes('next')) {
      framework = 'next';
      type = 'fullstack';
      approach = 'monolith';
    } else if (text.includes('static') || text.includes('website') || text.includes('web')) {
      // For a simple website, prefer next.js for better modern web capabilities
      framework = 'next';
      type = 'web';
      approach = 'component-based';
    } else if (text.includes('spa') || text.includes('single page')) {
      framework = 'react';
      type = 'web';
      approach = 'component-based';
    } else if (text.includes('api')) {
      framework = 'node';
      type = 'backend';
      approach = 'microservice';
    }
    
    // Language detection
    if (text.includes('typescript') || text.includes('ts')) {
      language = 'typescript';
    } else {
      language = 'javascript';
    }
    
    // Determine package manager preference based on framework
    if (framework === 'next' || framework === 'react') {
      packageManager = 'npm';
    } else if (framework === 'expo') {
      packageManager = 'npm'; 
    } else {
      packageManager = 'npm'; // Default
    }
    
    // Determine patterns and components to apply  
    const patterns: string[] = [];
    const components: string[] = [];
    
    if (framework === 'next') {
      patterns.push('app-router');
      patterns.push('server-components');
      components.push('pages');
      components.push('api-routes');
    } else if (framework === 'react') {
      patterns.push('component-pattern');
      patterns.push('state-management');
      components.push('components');
      components.push('hooks');
    } else if (framework === 'expo') {
      patterns.push('mobile-first');
      patterns.push('navigation');
      components.push('screens');
      components.push('components');
    } else if (framework === 'node') {
      patterns.push('express-pattern');
      patterns.push('modular-architecture');
      components.push('controllers');
      components.push('models'); 
      components.push('routes');
    }
    
    // Create the project blueprint with architectural decisions
    const projectBlueprint: ProjectBlueprint = {
      id: `bp-${Date.now()}`,
      name: blueprint.text.split(/\s+/).slice(0, 5).join('-'),
      description: blueprint.text,
      type,
      framework,
      language,
      packageManager,
      runtime,
      patterns,
      components,
      entryPoint: type === 'backend' ? 'src/server.ts' : 'src/main.jsx',
      structure: this.generateStructure(type, framework),
      dependencies: this.generateDependencies(framework, type),
      scripts: this.generateScripts(framework, type),
      hasPackageJson: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Cache the result
    this.cache.set(cacheKey, projectBlueprint);
    return projectBlueprint;
  }
  
  /**
   * Generate file structure based on project type and framework
   */
  private generateStructure(type: string, framework: string): string[] {
    const structure: string[] = [];
    
    if (type === 'web' || type === 'fullstack') {
      structure.push('public/');
      structure.push('src/');
      structure.push('src/components/');
      structure.push('src/pages/');
      structure.push('src/styles/');
      if (framework === 'next') {
        structure.push('src/app/');
        structure.push('src/lib/');
      }
    } else if (type === 'mobile') {
      structure.push('src/');
      structure.push('src/screens/');
      structure.push('src/components/');
      structure.push('src/navigation/');
    } else if (type === 'backend') {
      structure.push('src/');
      structure.push('src/controllers/');
      structure.push('src/models/');
      structure.push('src/routes/');
      structure.push('src/middleware/');
      structure.push('tests/');
    }
    
    structure.push('package.json');
    structure.push('README.md');
    structure.push('.gitignore');
    
    return structure;
  }
  
  /**
   * Generate dependencies based on framework and type
   */
  private generateDependencies(framework: string, type: string): Record<string, string> {
    const deps: Record<string, string> = {};
    
    switch (framework) {
      case 'react':
        deps['react'] = '^18.0.0';
        deps['react-dom'] = '^18.0.0';
        deps['vite'] = '^4.0.0'; 
        break;
      case 'next':
        deps['next'] = '^13.0.0';
        deps['react'] = '^18.0.0';
        deps['react-dom'] = '^18.0.0';
        break;
      case 'expo':
        deps['expo'] = '^49.0.0';
        deps['react'] = '^18.0.0';
        deps['react-native'] = '^0.72.0';
        break;
      case 'node':
        deps['express'] = '^4.0.0';
        if (type === 'backend') {
          deps['cors'] = '^2.0.0';
          deps['dotenv'] = '^16.0.0';
        }
        break;
    }
    
    // Common dependencies
    deps['typescript'] = '^5.0.0';
    deps['@types/react'] = '^18.0.0';
    
    return deps;
  }
  
  /**
   * Generate scripts based on project type and framework
   */
  private generateScripts(framework: string, type: string): Record<string, string> {
    const scripts: Record<string, string> = {};
    
    switch (framework) {
      case 'react':
        scripts['dev'] = 'vite';
        scripts['build'] = 'vite build';
        scripts['preview'] = 'vite preview';
        break;
      case 'next':
        scripts['dev'] = 'next dev';
        scripts['build'] = 'next build';
        scripts['start'] = 'next start';
        scripts['lint'] = 'next lint';
        break;
      case 'expo':
        scripts['start'] = 'expo start';
        scripts['android'] = 'expo run:android';
        scripts['ios'] = 'expo run:ios';
        scripts['web'] = 'expo start --web';
        break;
      case 'node':
        scripts['dev'] = 'nodemon src/server.ts';
        scripts['start'] = 'node dist/server.js';
        scripts['build'] = 'tsc';
        break;
    }
    
    return scripts;
  }
  
  /**
   * Generate Architecture Decision Records (ADRs) for analysis
   */
  generateADR(requirements: string[]): any[] {
    // Generate ADRs based on requirements 
    const adrList = [];
    
    for (let i = 0; i < requirements.length; i++) {
      adrList.push({
        id: `ADR-${i + 1}`,
        title: `Architecture decision for requirement: ${requirements[i]}`,
        status: 'proposed',
        decision: `Selected framework ${this.selectFrameworkFromRequirement(requirements[i])}`,
        date: new Date().toISOString(),
        rationale: `Requirement "${requirements[i]}" determined that this approach best satisfies project needs`
      });
    }
    
    return adrList;
  }
  
  /**
   * Helper to select framework from requirement text
   */
  private selectFrameworkFromRequirement(requirement: string): string {
    const text = requirement.toLowerCase();
    if (text.includes('mobile') || text.includes('app')) {
      return 'expo';
    } else if (text.includes('server') || text.includes('backend')) {
      return 'node';
    } else if (text.includes('website') || text.includes('web')) {
      return 'next';
    } else {
      return 'react';
    }
  }
  
  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      size: this.cache.size
    };
  }
}

/**
 * Module-level instance of ApplicationArchitect
 */
export const architect = new ApplicationArchitect();