// Store all captured output from the assembler
let capturedOutput: string[] = [];

// Build timestamp for cache busting - injected at build time
const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || Date.now().toString();

// Helper to get asset URL with correct base path for both local dev and GitHub Pages
// Includes cache-busting query parameter for static assets
const getAssetUrl = (path: string, bustCache = true) => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const url = `${normalizedBase}${path}`;
  return bustCache ? `${url}?v=${BUILD_VERSION}` : url;
};

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
  // Build the runtime URL to the file in `public/wasm`.
  const url = getAssetUrl('wasm/clownassembler_asm68k.js');

  // Load the Emscripten glue script as an ES module
  // The script uses import.meta, so it must be loaded as type="module"
  const ModuleFactory = await new Promise<any>((resolve, reject) => {
    // Check if already loaded
    if ((window as any).__clownAssemblerFactory) {
      resolve((window as any).__clownAssemblerFactory);
      return;
    }

    // Create a dynamic import via a blob URL to bypass Vite's static analysis
    // This works because the blob is evaluated at runtime, not build time
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.text();
      })
      .then(scriptText => {
        // Create a blob URL from the script content
        const blob = new Blob([scriptText], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Dynamically import the blob URL (this works with ES modules)
        return import(/* @vite-ignore */ blobUrl).then(mod => {
          URL.revokeObjectURL(blobUrl);
          return mod;
        });
      })
      .then(mod => {
        const factory = mod.default || mod.Module || mod;
        if (factory) {
          (window as any).__clownAssemblerFactory = factory;
          resolve(factory);
        } else {
          reject(new Error('Module factory not found after script load'));
        }
      })
      .catch(reject);
  });
  
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
        return getAssetUrl('wasm/clownassembler_asm68k.wasm');
      }
      return getAssetUrl(`wasm/${path}`);
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
