import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationArchitect } from '../src/ApplicationArchitect.ts';

test('ApplicationArchitect - Web application selects React + Vite + TypeScript', () => {
  const architect = new ApplicationArchitect();
  const bp = architect.analyze('Create a modern website for Ironclad Systems with dashboard and services');

  assert.equal(bp.framework, 'react');
  assert.equal(bp.type, 'web');
  assert.equal(bp.language, 'typescript');
  assert.equal(bp.packageManager, 'npm');
  assert.equal(bp.runtime, 'web');
  assert.equal(bp.entryPoint, 'src/main.tsx');
  assert.ok(bp.structure.includes('package.json'));
  assert.ok(bp.structure.includes('vite.config.ts'));
  assert.ok(bp.structure.includes('src/App.tsx'));
  assert.ok(bp.dependencies['react']);
  assert.ok(bp.scripts['dev']);
  assert.ok(bp.scripts['build']);
});

test('ApplicationArchitect - Mobile request selects Expo', () => {
  const architect = new ApplicationArchitect();
  const bp = architect.analyze('Build a mobile app for field technicians');

  assert.equal(bp.framework, 'expo');
  assert.equal(bp.type, 'mobile');
  assert.equal(bp.runtime, 'expo-web');
});

test('ApplicationArchitect - Backend API request selects Node', () => {
  const architect = new ApplicationArchitect();
  const bp = architect.analyze('Build a backend microservice server with REST endpoints');

  assert.equal(bp.framework, 'node');
  assert.equal(bp.type, 'backend');
  assert.equal(bp.runtime, 'node');
  assert.equal(bp.entryPoint, 'src/server.ts');
});

test('ApplicationArchitect - Fullstack SSR request selects Next.js', () => {
  const architect = new ApplicationArchitect();
  const bp = architect.analyze('Build a full-stack next.js portal with server rendering');

  assert.equal(bp.framework, 'next');
  assert.equal(bp.type, 'fullstack');
  assert.equal(bp.entryPoint, 'src/app/page.tsx');
});

test('ApplicationArchitect - Plain HTML request selects static-web', () => {
  const architect = new ApplicationArchitect();
  const bp = architect.analyze('A simple static html single landing page');

  assert.equal(bp.framework, 'static-web');
  assert.equal(bp.type, 'static-web');
  assert.equal(bp.hasPackageJson, false);
  assert.equal(bp.entryPoint, 'index.html');
});

test('ApplicationArchitect - Caching behavior', () => {
  const architect = new ApplicationArchitect();
  const prompt = 'Modern enterprise dashboard for cybersecurity';
  const bp1 = architect.analyze(prompt);
  const bp2 = architect.analyze(prompt);

  assert.equal(bp1.id, bp2.id);
  const stats = architect.getCacheStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
});
