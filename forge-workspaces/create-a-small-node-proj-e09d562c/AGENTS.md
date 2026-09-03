# Forge Agent Instructions

## Blueprint

Create a small Node project in this folder: 1) package.json with "type": "module" and scripts { "build": "node build.mjs", "start": "node server.mjs" }. 2) build.mjs that prints "FORGE_LIVE_OK" and writes dist/output.txt containing "FORGE_LIVE_OK". 3) server.mjs: an HTTP server that listens on 127.0.0.1:5173, responds 200 with HTML "<h1>FORGE_LIVE_PREVIEW</h1>",    and prints exactly "Listening on http://127.0.0.1:5173". 4) a README.md with one line describing the project. Keep it minimal — no external dependencies.

## Constraints

- You may only read and write files inside this workspace.
- Create every file the blueprint requires. Do not leave stubs or placeholders.
- Use modern idiomatic TypeScript/JavaScript for web projects.
- Do not modify any files outside this workspace.
- Do not execute destructive commands (rm -rf, etc.) outside node_modules.
