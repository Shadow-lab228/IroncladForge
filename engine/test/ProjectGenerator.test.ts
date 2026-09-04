import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forgeProjectFromBlueprint } from '../../src/forge/projectGenerator.ts';

test('ProjectGenerator - Generates coherent React+Vite project from blueprint', () => {
  const blueprintText = 'Create a modern website for Ironclad Systems with security auditing services, products showcase, and component architecture.';
  const project = forgeProjectFromBlueprint(blueprintText);

  assert.ok(project.id.startsWith('forge-'));
  assert.equal(project.status, 'quenched');
  assert.equal(project.framework, 'React + TypeScript + Vite');
  assert.equal(project.language, 'TypeScript');
  assert.equal(project.packageManager, 'npm');
  assert.ok(project.port === 5173);
  assert.ok(project.previewUrl.startsWith('data:text/html'));

  const fileMap = new Map(project.files.map(f => [f.path, f]));

  // Verify critical files
  assert.ok(fileMap.has('package.json'), 'Must contain package.json');
  assert.ok(fileMap.has('tsconfig.json'), 'Must contain tsconfig.json');
  assert.ok(fileMap.has('vite.config.ts'), 'Must contain vite.config.ts');
  assert.ok(fileMap.has('index.html'), 'Must contain index.html');
  assert.ok(fileMap.has('src/main.tsx'), 'Must contain src/main.tsx');
  assert.ok(fileMap.has('src/App.tsx'), 'Must contain src/App.tsx');
  assert.ok(fileMap.has('src/components/Header.tsx'), 'Must contain Header component');
  assert.ok(fileMap.has('src/components/Hero.tsx'), 'Must contain Hero component');
  assert.ok(fileMap.has('src/components/Features.tsx'), 'Must contain Features component');
  assert.ok(fileMap.has('src/components/Footer.tsx'), 'Must contain Footer component');

  // Verify package.json content
  const pkgContent = JSON.parse(fileMap.get('package.json')!.content!);
  assert.equal(pkgContent.type, 'module');
  assert.ok(pkgContent.scripts.dev);
  assert.ok(pkgContent.scripts.build);
  assert.ok(pkgContent.dependencies.react);
  assert.ok(pkgContent.dependencies['react-dom']);
  assert.ok(pkgContent.devDependencies.vite);
  assert.ok(pkgContent.devDependencies.typescript);

  // Verify HTML title and root element
  const indexHtml = fileMap.get('index.html')!.content!;
  assert.ok(indexHtml.includes('<div id="root"></div>'));
  assert.ok(indexHtml.includes('src/main.tsx'));

  // Verify App.tsx content has components
  const appTsx = fileMap.get('src/App.tsx')!.content!;
  assert.ok(appTsx.includes('<Header'));
  assert.ok(appTsx.includes('<Hero'));
  assert.ok(appTsx.includes('<Features'));
  assert.ok(appTsx.includes('<Footer'));
});

test('ProjectGenerator - Generates static project fallback for plain html', () => {
  const project = forgeProjectFromBlueprint('A plain static html page');
  assert.equal(project.status, 'quenched');
  assert.equal(project.framework, 'static-web');
  const fileMap = new Map(project.files.map(f => [f.path, f]));
  assert.ok(fileMap.has('index.html'));
  assert.ok(fileMap.has('README.md'));
});
