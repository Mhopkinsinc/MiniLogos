# MiniLogos — Architecture Overview

**Purpose**
- MiniLogos is a small React + TypeScript single-page app that patches Sega Genesis NHL '94 ROMs using a WebAssembly-compiled assembler (clownassembler). The app provides file upload, patch configuration, preview canvases, and a patch/download workflow.

**High-level Architecture**
- UI: React components under [components](components/) drive user interaction and previews.
- Services: `services/wasmLoader.ts` and `services/patcherService.ts` handle loading the Emscripten WASM module, writing files to the WASM FS, running the assembler, and returning the patched binary.
- Static WASM + scripts: served from [public/wasm](public/wasm).
- State: Top-level React state in [App.tsx](App.tsx) is passed down via props; there is no global context or external store.

**Files & Folders (quick map)**
- [App.tsx](App.tsx): Root component. Holds main state (current file, config, processing status, output blob) and orchestrates patch flow.
- [index.tsx](index.tsx): App bootstrap and React DOM mount.
- [components/](components/): UI components (SidebarControls, Workspace, FileUpload, DebugPanel, etc.).
- [services/](services/): `wasmLoader.ts` and `patcherService.ts` for WASM integration and patch pipeline.
- [assets/](assets/): Static preview assets (base64 previews) used by the workspace preview UI.
- [public/wasm](public/wasm): `clownassembler_asm68k.js`, `.wasm`, `patch.asm`, and `scripts/` required by the assembler.
- [package.json](package.json): Scripts (`dev`, `build`, `preview`) and dependencies.
- [vite.config.ts](vite.config.ts): Vite + React plugin and alias configuration.
- [tsconfig.json](tsconfig.json) and [types.ts](types.ts): TypeScript config and shared types.

**Components (responsibilities & relations)**
- `Layout` — [components/Layout.tsx](components/Layout.tsx)
  - Page shell (header, left slot, main area). Hosts the sidebar and workspace.
- `SidebarControls` — [components/SidebarControls.tsx](components/SidebarControls.tsx)
  - Primary controls: accepts file selection via `FileUpload`, selects patch modes/toggles, and triggers patching via callbacks to `App`.
  - Children: `FileUpload`.
- `FileUpload` — [components/FileUpload.tsx](components/FileUpload.tsx)
  - Drag/drop or select ROM file, normalizes into app file shape and emits selection to parent.
- `Workspace` — [components/Workspace.tsx](components/Workspace.tsx)
  - Shows preview canvases (consuming `assets/*` previews) and the download UI once `App` provides the patched output.
- `DebugPanel` — [components/DebugPanel.tsx](components/DebugPanel.tsx)
  - Dev tooling to inspect Emscripten FS exposed by the loaded WASM module and view assembler logs / FS files.
- `Button`, `Icons`, `InstructionsModal`, `ConfigPanel` — small UI pieces used across the app.

**Services & WASM Integration**
- `wasmLoader.ts` — [services/wasmLoader.ts](services/wasmLoader.ts)
  - Dynamically imports the Emscripten glue script (`clownassembler_asm68k.js`) from `/wasm/` and exposes the module (and captured stdout/stderr) for `patcherService` and `DebugPanel`.
  - Ensures `.wasm` file paths are resolved to `/wasm/` when the module requests them.
- `patcherService.ts` — [services/patcherService.ts](services/patcherService.ts)
  - Orchestrates the patch flow: reads the uploaded ROM ArrayBuffer, fetches `patch.asm` and `scripts/*` from `/wasm/`, writes files into the module FS, runs the assembler, and reads back the generated patch binary.
  - Returns a downloadable Blob (and filename) to `App`.
- Files under [public/wasm](public/wasm) are served statically; the loader fetches and writes needed script files into the WASM FS before invoking assembler entrypoints.

**Data Flow**
- Entry: user selects a ROM via `FileUpload` inside `SidebarControls`.
- App state: `App.tsx` stores the selected file, UI config, `isProcessing`, and `downloadUrl` / output blob.
- Trigger: `SidebarControls` invokes `App` callback to start patching. `App` calls `patcherService.patchRom()`.
- Processing: `patcherService` uses `wasmLoader` to load the module, writes files into the Emscripten FS, runs the assembler, reads output, and returns the patched Blob.
- UI update: `App` receives the Blob, creates a download URL and passes it to `Workspace` to present the download button and preview.
- Debugging: `DebugPanel` can read `window.__clownAssemblerModule.FS` (where exposed) to inspect files and logs.

**Assets & Previews**
- Preview sources: [assets/miniLogosPreview.ts](assets/miniLogosPreview.ts), [assets/inGamePreview.ts](assets/inGamePreview.ts), [assets/playoffPreview.ts](assets/playoffPreview.ts), [assets/teamSelectPreview.ts](assets/teamSelectPreview.ts).
- These export base64 image data used by `Workspace` preview cards.

**Build & Run**
- Key npm scripts (from [package.json](package.json)):

```bash
npm run dev    # start vite dev server
npm run build  # build for production
npm run preview# locally preview production build
```

- Vite config: [vite.config.ts](vite.config.ts) configures React plugin and an alias `@` → project root; dev server host/port are set. WASM files are served from `public/wasm` and loaded at runtime by the loader.

**Component Relationship Graph (short)**
- [App.tsx](App.tsx) -> renders -> [components/Layout.tsx](components/Layout.tsx)
- [App.tsx](App.tsx) -> renders -> [components/SidebarControls.tsx](components/SidebarControls.tsx)
- [App.tsx](App.tsx) -> renders -> [components/Workspace.tsx](components/Workspace.tsx)
- [components/SidebarControls.tsx](components/SidebarControls.tsx) -> uses -> [components/FileUpload.tsx](components/FileUpload.tsx)
- [App.tsx](App.tsx) -> calls -> [services/patcherService.ts](services/patcherService.ts)
- [services/patcherService.ts](services/patcherService.ts) -> uses -> [services/wasmLoader.ts](services/wasmLoader.ts)
- [components/DebugPanel.tsx](components/DebugPanel.tsx) -> reads -> wasm FS exposed by `wasmLoader`
- `assets/*` -> consumed by -> [components/Workspace.tsx](components/Workspace.tsx)

**Extending the app**
- Add new patch options: extend UI in `SidebarControls`, add config handling in `App`, and update `patcherService` to transform `patch.asm` or inject new script files.
- Add previews: put new base64 preview exports in `assets/` and render in `Workspace` preview cards.
- Add tests: introduce unit tests for pure functions and integration tests that mock `wasmLoader` to verify `patcherService` behavior.