/**
 * Verification script to test that static website detection works
 */
import { detectProject } from '../engine/src/ProjectDetector.ts';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, join } from 'node:path';

// Function to create a mock workspace similar to the reproduction case
function createStaticWebWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'static-web-test-'));
  
  // Create index.html with references like the reproduction case
  writeFileSync(
    join(dir, 'index.html'),
    `<html>
      <head>
        <title>Ironclad Systems</title>
        <link rel="stylesheet" href="styles.css">
      </head>
      <body>
        <h1>Ironclad Systems</h1>
        <p>Secure Software Solutions</p>
        <script src="script.js"></script>
      </body>
    </html>`
  );
  
  // Create CSS file  
  writeFileSync(
    join(dir, 'styles.css'),
    `body { 
      font-family: Arial, sans-serif; 
      margin: 0;
      padding: 20px;
    }`
  );
  
  // Create JS file
  writeFileSync(
    join(dir, 'script.js'),
    `console.log('Ironclad Systems website loaded');`
  );
  
  return dir;
}

// Test case - our core scenario from the reproduction
try {
  const workspaceDir = createStaticWebWorkspace();
  console.log('Testing static HTML workspace:', workspaceDir);
  
  const detection = detectProject(workspaceDir);
  
  console.log('\nDetection results:');
  console.log('- Framework:', detection.framework);
  console.log('- Language:', detection.language); 
  console.log('- Package manager:', detection.packageManager);
  console.log('- Preview kind:', detection.previewKind);
  console.log('- Has package.json:', detection.hasPackageJson);
  console.log('- Start script name:', detection.startScriptName);
  
  if (detection.framework === 'static' && detection.previewKind === 'static') {
    console.log('\n✅ PASS: Static HTML project correctly detected as STATIC_WEB');
  } else {
    console.log('\n❌ FAIL: Failed to detect static HTML project');
    process.exit(1);
  }
  
} catch (error) {
  console.error('Test failed:', error);
  process.exit(1);
}