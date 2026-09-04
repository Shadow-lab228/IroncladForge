/**
 * Test script to verify that static website detection works properly.
 * This simulates a simple static HTML/CSS/JS project with index.html referencing assets
 */
import { detectProject } from './engine/src/ProjectDetector.ts';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Function to create a mock workspace similar to what would be generated
function createStaticProjectWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'static-test-'));
  
  // Create index.html with references
  writeFileSync(
    join(dir, 'index.html'),
    `<html>
      <head>
        <link rel="stylesheet" href="styles/main.css">
      </head>
      <body>
        <h1>Hello</h1>
        <script src="js/app.js"></script>
      </body>
    </html>`
  );
  
  // Create directory structure for referenced files
  mkdirSync(join(dir, 'styles'), { recursive: true });
  mkdirSync(join(dir, 'js'), { recursive: true });
  
  // Create CSS file
  writeFileSync(
    join(dir, 'styles', 'main.css'),
    `body { color: blue; }`
  );
  
  // Create JS file  
  writeFileSync(
    join(dir, 'js', 'app.js'),
    `console.log('Hello world');`
  );
  
  return dir;
}

// Test case
try {
  const workspaceDir = createStaticProjectWorkspace();
  console.log('Testing workspace:', workspaceDir);
  
  const detection = detectProject(workspaceDir);
  
  console.log('Detection result:');
  console.log('- Framework:', detection.framework);
  console.log('- Preview kind:', detection.previewKind); 
  console.log('- Has package.json:', detection.hasPackageJson);
  
  if (detection.framework === 'static') {
    console.log('✅ Static HTML project correctly detected!');
  } else {
    console.log('❌ Failed to detect static HTML project - got framework:', detection.framework);
  }
  
  // Cleanup
  import('node:fs').then(fs => {
    fs.rmSync(workspaceDir, { recursive: true });
  }).catch(console.error);
} catch (error) {
  console.error('Test failed:', error);
}