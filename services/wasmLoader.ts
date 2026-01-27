export async function loadClownAssembler(): Promise<any> {
  // Build the runtime URL to the file in `public/wasm` so Vite doesn't
  // attempt to statically analyze it. Use a dynamic import with
  // `/* @vite-ignore */` so the path is evaluated at runtime.
  const url = `${typeof window !== 'undefined' && window.location ? window.location.origin : ''}/wasm/clownassembler_asm68k.js`;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - dynamic import with runtime URL
  const mod = await import(/* @vite-ignore */ url);
  const ModuleFactory = mod.default;
  const module = await ModuleFactory({
    // Prevent the module from auto-running main() on initialization
    noInitialRun: true,
    locateFile: (path: string) => {
      // The asm68k glue may request a specific wasm filename; ensure we
      // map any wasm request to the asm68k wasm binary.
      if (typeof path === 'string' && path.endsWith('.wasm')) {
        return `/wasm/clownassembler_asm68k.wasm`;
      }
      return `/wasm/${path}`;
    },
    print: (s: any) => console.log('[clownassembler]', s),
    printErr: (s: any) => {
      // Filter out verbose argv debug messages - these are informational, not errors
      const msg = String(s);
      if (msg.includes('[argv]')) {
        console.debug('[clownassembler]', s);
      } else {
        console.error('[clownassembler]', s);
      }
    },
  });

  // Expose module for debugging in development
  try {
    if (typeof window !== 'undefined') {
      // Always expose for easier debugging; safe to remove in production builds
      (window as any).__clownAssemblerModule = module;
    }
  } catch {}

  return module;
}

// Attach loader to window for manual invocation from the DevTools console
try {
  if (typeof window !== 'undefined') {
    (window as any).loadClownAssembler = loadClownAssembler;
  }
} catch {}
