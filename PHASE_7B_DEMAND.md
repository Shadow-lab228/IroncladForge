# PHASE 7B DEMAND: AUTONOMOUS DEVELOPMENT ENVIRONMENT REQUIREMENTS

## The Problem with Current Implementation

Current Forge behavior:
- Generates files but shows "UNSUPPORTED" in PreviewPanel
- Doesn't actually run development servers  
- Doesn't detect real ports
- Only shows static HTML placeholders
- No real application content verification

## Critical Architecture Requirements for Phase 7B

### 1. PERSISTENT SERVER PROCESSES (NOT ONE-SHOT COMMANDS)
```typescript
// WRONG - terminates after build:
// const result = await runCommand('npm run dev');
// result.exitCode = 0; // process exits immediately

// CORRECT - persistent server:
class ProjectRuntime {
  private process: ChildProcess; // NOT CommandResult
  
  async start() {
    this.process = spawn('npm', ['run', 'dev'], { cwd: projectDir }); 
    // Process stays alive - can be stopped, monitored, etc.
    return this.process.pid;
  }
  
  async stop() {
    process.kill(this.process.pid, 'SIGTERM');
    // Actually terminates the server process
  }
}
```

### 2. REAL PORT DETECTION (NOT HARDCODED DEFAULTS)
```typescript
// WRONG - hardcoded port:
const port = 5173; // Vite default

// CORRECT - extract from output:
const detectedPort = parsePortFromOutput(stdout); 
// "listening on http://localhost:43127"
// vs "listening on http://localhost:5173" (when server uses non-default)
```

### 3. HTTP READINESS WITH CONTENT VALIDATION
```typescript
// WRONG - simple 200 check:
if (response.status === 200) { /* ready */ }

// CORRECT - content verification:
const contentValid = await verifyApplicationContent(url, ['Ironclad Systems', 'Homepage']);
if (contentValid && response.status === 200) { /* true readiness */ }
```

### 4. FRAMEWORK-AWARE RUNTIME SELECTION  
```typescript
// WRONG - always assumes npm run dev:
const cmd = 'npm run dev';

// CORRECT - detects package.json scripts:
if (pkg.scripts.dev) cmd = 'npm run dev';
else if (pkg.scripts.start) cmd = 'npm run start'; 
else if (pkg.scripts.preview) cmd = 'npm run preview';
```

### 5. PROPER ERROR HANDLING FOR REPAIR SYSTEM
```typescript
// WRONG - generic failure:
{ error: "Build failed" }

// CORRECT - detailed diagnostics:
{
  command: "npm run build",
  exitCode: 1,
  stdout: "...build output...",
  stderr: "...error details...",
  workspacePath: "/project",
  blueprint: {...}
}
```

## Integration Points

### PreviewRunner.ts (Main Module)
Must be enhanced to:
- Use ChildProcess instead of CommandResult
- Track actual PIDs  
- Parse port from server outputs
- Implement HTTP readiness checks
- Validate application content before showing "READY"

### File Structure Changes Needed
Current (incorrect):  
```
index.html
script.js
styles.css
```

Required (correct):
``` 
package.json
vite.config.ts
src/
  main.tsx
  App.tsx
  components/
public/
README.md
```

## End-to-End Pipeline

```text
USER PROMPT → REQUIREMENTS → ARCHITECTURE → BLUEPRINT 
    ↓
COMPLETE PROJECT GENERATION  
    ↓  
PACKAGE.JSON + DEPENDENCIES
    ↓
INSTALL: npm install (REAL EXECUTION)  
    ↓
BUILD: npm run build (REAL EXECUTION)
    ↓
RUNTIME START: npm run dev (PERSISTENT PROCESS)
    ↓  
PORT DETECTION (FROM STDOUT PARSING)
    ↓
HTTP READINESS CHECKS
    ↓
CONTENT VERIFICATION  
    ↓
PREVIEW READY: ACTUAL URL LOADING REAL APP
```

## Verification Criteria

### Before Fix:
- PreviewPanel shows "UNSUPPORTED"
- No runtime process starts
- Port = 5173 (hardcoded default) 
- HTTP check = 200 only (no content verification)

### After Fix:
- PreviewPanel shows real URL like http://localhost:43127
- Runtime is actual Node.js persistent process  
- Port detected from server output (not default)
- HTTPS with validation succeeds before preview ready
- Real application content loads in preview

## PROOF OF CONCEPT DEMO

To demonstrate Phase 7B working:
1. Run "Create React website for Ironclad Systems" 
2. Verify generated project structure matches React/Vite expectations  
3. Execute `npm install` and `npm run build` (real package manager)
4. Launch `npm run dev` as persistent process
5. Parse actual output to discover port (e.g., 43127 from "listening on http://localhost:43127")
6. Validate actual HTTP response content contains expected markers
7. Present URL to PreviewPanel 
8. Confirm runtime can be stopped and process terminates

This demonstrates an entirely autonomous development environment where Forge:
- Generates full working projects instead of placeholders
- Runs real development servers
- Detects actual ports used by frameworks  
- Verifies app content before showing preview
- Integrates with repair systems when errors occur  
- Provides real terminal output in UI