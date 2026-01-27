// Store all captured output from the assembler
let capturedOutput: string[] = [];

/**
 * Get all captured output from the last assembly run
 */
export function getCapturedOutput(): string[] {
  return [...capturedOutput];
}

/**
 * Clear captured output (call before starting a new assembly)
 */
export function clearCapturedOutput(): void {
  capturedOutput = [];
}

export async function loadClownAssembler(): Promise<any> {
  // Build the runtime URL to the file in `public/wasm` so Vite doesn't
  // attempt to statically analyze it. Use a dynamic import with
  // `/* @vite-ignore */` so the path is evaluated at runtime.
  const url = `${typeof window !== 'undefined' && window.location ? window.location.origin : ''}/wasm/clownassembler_asm68k.js`;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - dynamic import with runtime URL
  const mod = await import(/* @vite-ignore */ url);
  const ModuleFactory = mod.default;
  
  // Capture all output from the assembler
  const captureOutput = (s: any) => {
    const msg = String(s);
    capturedOutput.push(msg);
    console.log('[clownassembler]', s);
  };
  
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
    print: captureOutput,
    printErr: captureOutput,
  });
  
  // Ensure handlers stay bound after initialization
  module.print = captureOutput;
  module.printErr = captureOutput;

  // Expose module for debugging in development
  try {
    if (typeof window !== 'undefined') {
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
