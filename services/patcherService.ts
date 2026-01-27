import { PatchConfig, PatcherMode } from '../types';
import { loadClownAssembler } from './wasmLoader';

export interface PatchResult {
  blob: Blob;
  filename: string;
}

/**
 * Applies the UI configuration to the patch.asm content by replacing
 * the variable values with the selected settings.
 */
const applyConfigToPatchAsm = (asmContent: string, config: PatchConfig): string => {
  let content = asmContent;

  // Mode settings - mutually exclusive
  const useBannerMode = config.mode === PatcherMode.FullBanners ? 1 : 0;
  const useStandaloneMode = config.mode === PatcherMode.MiniLogosOnly ? 1 : 0;

  // Replace mode variables
  content = content.replace(/^(UseBannerMode\s*=\s*)\d+/m, `$1${useBannerMode}`);
  content = content.replace(/^(UseStandaloneMode\s*=\s*)\d+/m, `$1${useStandaloneMode}`);

  // Replace feature toggles
  content = content.replace(
    /^(EnableTeamSelectBanners\s*=\s*)\d+/m,
    `$1${config.options.enableTeamSelectBanners ? 1 : 0}`
  );
  content = content.replace(
    /^(EnableInGameBanners\s*=\s*)\d+/m,
    `$1${config.options.enableInGameBanners ? 1 : 0}`
  );
  content = content.replace(
    /^(EnablePlayoffBanners\s*=\s*)\d+/m,
    `$1${config.options.enablePlayoffBanners ? 1 : 0}`
  );
  content = content.replace(
    /^(EnableMiniLogos\s*=\s*)\d+/m,
    `$1${config.options.enableMiniLogos ? 1 : 0}`
  );

  return content;
};

/**
 * Patches the provided ROM file buffer with the selected configuration.
 * Attempts to load and call into the WASM module; if no compatible export
 * is found, falls back to the existing simulated behavior.
 */
export const patchRom = async (fileData: ArrayBuffer, config: PatchConfig, filename = 'input.bin'): Promise<PatchResult> => {
  console.log('Starting patch process...');
  console.log('Configuration:', config);

  // Calculate the output filename upfront
  const outputName = `${filename.replace(/\.[^.]+$/, '')}_patched.bin`;

  // Try to load the wasm module (served from /wasm/)
  let wasmModule: any = null;
  try {
    wasmModule = await loadClownAssembler();
  } catch (e) {
    console.warn('Failed to load WASM module, falling back to JS simulation.', e);
  }

  if (wasmModule) {
    const FS = wasmModule.FS as any;

    // Ensure directories exist
    try { FS.mkdirTree('/rom'); } catch {}
    try { FS.mkdirTree('/scripts'); } catch {}

    // Write ROM into /rom/nhl94.bin (renamed from original filename)
    try {
      FS.writeFile('/rom/nhl94.bin', new Uint8Array(fileData));
    } catch (e) {
      console.warn('Failed to write ROM into wasm FS:', e);
      // fall through to fallback
    }

    // Helper: fetch a script file from /wasm/scripts and write to /scripts
    const fetchAndWrite = async (relPath: string) => {
      const url = `/wasm/scripts/${relPath}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
        const buf = await res.arrayBuffer();
        // ensure nested dirs
        const parts = relPath.split('/');
        if (parts.length > 1) {
          const dir = '/scripts/' + parts.slice(0, -1).join('/');
          try { FS.mkdirTree(dir); } catch {}
        }
        FS.writeFile(`/scripts/${relPath}`, new Uint8Array(buf));
        return new TextDecoder().decode(buf);
      } catch (e) {
        console.warn('Could not fetch script', url, e);
        return null;
      }
    };

    // First, try to load a manifest list.json with an array of paths
    let scriptFiles: string[] = [];
    try {
      const manifestRes = await fetch('/wasm/scripts/list.json');
      if (manifestRes.ok) {
        scriptFiles = await manifestRes.json();
      }
    } catch {}

    // Always fetch the main patch.asm first (from /wasm/), apply config, and write to root
    try {
      const patchRes = await fetch('/wasm/patch.asm');
      if (patchRes.ok) {
        const patchText = await patchRes.text();
        const modifiedAsm = applyConfigToPatchAsm(patchText, config);
        const encoder = new TextEncoder();
        FS.writeFile('/patch.asm', encoder.encode(modifiedAsm));
        console.log('[patcher] Applied config to patch.asm:', config);
      }
    } catch (e) {
      console.warn('Could not fetch /wasm/patch.asm:', e);
    }

    // If no manifest, at minimum fetch patch.asm from scripts folder and try to resolve includes
    if (scriptFiles.length === 0) {
      const mainAsm = await fetchAndWrite('patch.asm');
      if (mainAsm) {
        const includes = new Set<string>();
        // Match typical include directives and quoted filenames
        const includeRe = /(?:include|INCLUDE|\.include)\s+["']?([^"'\s]+)["']?/g;
        let m;
        while ((m = includeRe.exec(mainAsm)) !== null) {
          includes.add(m[1]);
        }
        // Also match generic referenced filenames like "somefile.inc"
        const fileRe = /["']([^"']+\.(?:asm|inc|bin|s|dat|h))["']/gi;
        while ((m = fileRe.exec(mainAsm)) !== null) {
          includes.add(m[1]);
        }
        scriptFiles = Array.from(includes.values());
      }
    }

    // Fetch discovered files
    for (const f of scriptFiles) {
      await fetchAndWrite(f);
    }

    // Ensure current working directory is root
    try { FS.chdir('/'); } catch {}

    // Build args for the assembler. Some builds expect the source and
    // object/output filenames to be provided as a single comma-separated
    // token (e.g. `patch.asm,output.bin`). Provide `/p` followed
    // by that combined token to match those builds.
    const scriptToken = `patch.asm,${outputName}`;
    const args = ['/p', scriptToken];

    // Hook module stdout/stderr to our console so assembler messages appear
    // with a predictable prefix and ordering relative to our debug logs.
    try {
      if (typeof (wasmModule as any).print === 'function') {
        (wasmModule as any).print = (...m: any[]) => console.log('[clownassembler]', ...m);
      }
      if (typeof (wasmModule as any).printErr === 'function') {
        (wasmModule as any).printErr = (...m: any[]) => console.error('[clownassembler]', ...m);
      }
      // Also attempt to set the embedded Module.* hooks some builds expose
      try {
        (wasmModule as any).Module = (wasmModule as any).Module || {};
        (wasmModule as any).Module.print = (...m: any[]) => console.log('[clownassembler]', ...m);
        (wasmModule as any).Module.printErr = (...m: any[]) => console.error('[clownassembler]', ...m);
      } catch {}
    } catch (e) {
      // best-effort; if we can't patch prints, continue
    }

    // Debug visibility for the exact arguments passed into the module
    console.log('[clownassembler] callMain args:', JSON.stringify(args));

    // Call into the module via callMain if available
    try {
      if (typeof wasmModule.callMain === 'function') {
        try {
          // Some Emscripten builds read `Module.arguments`; set it for
          // compatibility before invoking `callMain`.
          try { wasmModule.arguments = args; } catch {}
          // Also set the global debug reference if present to be safe
          try { (window as any).__clownAssemblerModule = (window as any).__clownAssemblerModule || wasmModule; (window as any).__clownAssemblerModule.arguments = args; } catch {}
          wasmModule.callMain(args);
        } catch (e) {
          // emscripten may throw an ExitStatus; ignore
          console.debug('callMain finished with:', e);
        }
      } else if (typeof wasmModule.run === 'function') {
        // some modules expose run; set Module.arguments then call run
        wasmModule.arguments = args;
        wasmModule.run();
      } else {
        console.warn('No callMain/run found on wasm module; cannot execute assembler');
      }

      // List root directory to see what files were created
      try {
        const rootFiles = FS.readdir('/');
        console.log('[clownassembler] Root directory after assembly:', rootFiles);
      } catch (e) {
        console.warn('Could not list root directory:', e);
      }

      // Read output file - try the expected output name first, then look for any .bin file
      const outPath = `/${outputName}`;
      console.log('[clownassembler] Looking for output at:', outPath);
      
      // Helper function to read and return the patched ROM blob
      const readPatchedFile = (path: string): Blob | null => {
        try {
          const raw = FS.readFile(path, { encoding: 'binary' }) as any;
          let outBytes: Uint8Array;
          if (raw instanceof Uint8Array) {
            outBytes = raw;
          } else if (Array.isArray(raw)) {
            outBytes = new Uint8Array(raw);
          } else if (raw && raw.buffer) {
            outBytes = new Uint8Array(raw.buffer);
          } else {
            return null;
          }

          if (outBytes && outBytes.length) {
            console.log(`[clownassembler] Successfully read ${path} (${outBytes.length} bytes)`);
            const ab = outBytes.slice().buffer;
            return new Blob([ab], { type: 'application/octet-stream' });
          }
        } catch (e) {
          console.warn(`Could not read ${path}:`, e);
        }
        return null;
      };

      // Try expected output path first
      let patchedBlob = readPatchedFile(outPath);
      
      // If not found, search for any newly created .bin file in root (excluding nhl94.bin)
      if (!patchedBlob) {
        try {
          const rootFiles = FS.readdir('/') as string[];
          for (const file of rootFiles) {
            if (file.endsWith('.bin') && file !== 'nhl94.bin' && file !== '.' && file !== '..') {
              console.log(`[clownassembler] Trying alternate output file: /${file}`);
              patchedBlob = readPatchedFile(`/${file}`);
              if (patchedBlob) break;
            }
          }
        } catch (e) {
          console.warn('Could not search for output files:', e);
        }
      }

      if (patchedBlob) {
        return { blob: patchedBlob, filename: outputName };
      }
    } catch (e) {
      console.warn('Error invoking wasm assembler:', e);
    }
  }

  // SIMULATION: fallback behavior (keeps original behavior for now)
  await new Promise(resolve => setTimeout(resolve, 1500));
  return { blob: new Blob([fileData], { type: 'application/octet-stream' }), filename: outputName };
};

/**
 * Helper to read a File object as ArrayBuffer
 */
export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};