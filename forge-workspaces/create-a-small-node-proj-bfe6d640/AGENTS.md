# Forge Agent Instructions

## Blueprint

Create a small Node project in this folder: 1) package.json with "type": "module" and a scripts.build of "node build.mjs". 2) build.mjs that prints "FORGE_LIVE_OK" and writes dist/output.txt containing "FORGE_LIVE_OK". 3) a README.md with one line describing the project. Keep it minimal — no external dependencies.

## Constraints

- You may only read and write files inside this workspace.
- Create every file the blueprint requires. Do not leave stubs or placeholders.
- Use modern idiomatic TypeScript/JavaScript for web projects.
- Do not modify any files outside this workspace.
- Do not execute destructive commands (rm -rf, etc.) outside node_modules.
