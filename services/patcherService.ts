import { PatchConfig, PatcherMode, PresetOverride } from '../types';
import { loadClownAssembler, getCapturedOutput, clearCapturedOutput } from './wasmLoader';

// Helper to get asset URL with correct base path for both local dev and GitHub Pages
const getAssetUrl = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path}`;
};

export interface PatchResult {
  blob: Blob;
  filename: string;
}

/**
 * Map of preset overrides keyed by their relative path (e.g., "minilogos/minilogos_32_teams.jim")
 */
export type PresetOverrides = Map<string, PresetOverride>;

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

  // Experimental: 32 Teams option (only applies when using MiniLogosOnly mode)
  const use32Teams = config.mode === PatcherMode.MiniLogosOnly && config.options.use32Teams ? 1 : 0;
  content = content.replace(/^(Use32Teams\s*=\s*)\d+/m, `$1${use32Teams}`);

  return content;
};

/**
 * Patches the provided ROM file buffer with the selected configuration.
 * Attempts to load and call into the WASM module; if no compatible export
 * is found, falls back to the existing simulated behavior.
 * 
 * @param fileData - The ROM file buffer
 * @param config - Patch configuration options
 * @param filename - Original filename (used for output naming)
 * @param presetOverrides - Optional map of preset files to override with custom JIM data
 */
export const patchRom = async (
  fileData: ArrayBuffer, 
  config: PatchConfig, 
  filename = 'input.bin',
  presetOverrides?: PresetOverrides
): Promise<PatchResult> => {
  // Clear any previous output before starting
  clearCapturedOutput();
  
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
      const url = getAssetUrl(`wasm/scripts/${relPath}`);
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
      const manifestRes = await fetch(getAssetUrl('wasm/scripts/list.json'));
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        // Handle both string entries and object entries with { path, displayName }
        scriptFiles = manifest.map((entry: string | { path: string }) => 
          typeof entry === 'string' ? entry : entry.path
        );
      }
    } catch {}

    // Always fetch the main patch.asm first (from /wasm/), apply config, and write to root
    try {
      const patchRes = await fetch(getAssetUrl('wasm/patch.asm'));
      if (patchRes.ok) {
        const patchText = await patchRes.text();
        const modifiedAsm = applyConfigToPatchAsm(patchText, config);
        const encoder = new TextEncoder();
        FS.writeFile('/patch.asm', encoder.encode(modifiedAsm));
        console.log('[patcher] Applied config to patch.asm:', config);
      }
    } catch (e) {
      console.warn('Could not fetch patch.asm:', e);
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

    // Apply any preset overrides (custom .jim files uploaded by the user)
    if (presetOverrides && presetOverrides.size > 0) {
      for (const [presetPath, override] of presetOverrides) {
        const targetPath = `/scripts/${presetPath}`;
        try {
          // Ensure the directory exists
          const parts = presetPath.split('/');
          if (parts.length > 1) {
            const dir = '/scripts/' + parts.slice(0, -1).join('/');
            try { FS.mkdirTree(dir); } catch {}
          }
          FS.writeFile(targetPath, override.jimData);
          console.log(`[patcher] Applied custom override for ${presetPath} (${override.jimData.length} bytes, source: ${override.sourceName || 'unknown'})`);
        } catch (e) {
          console.warn(`[patcher] Failed to apply override for ${presetPath}:`, e);
        }
      }
    }

    // Ensure current working directory is root
    try { FS.chdir('/'); } catch {}

    // Build args for the assembler. Some builds expect the source and
    // object/output filenames to be provided as a single comma-separated
    // token (e.g. `patch.asm,output.bin`). Provide `/p` followed
    // by that combined token to match those builds.
    const scriptToken = `patch.asm,${outputName}`;
    const args = ['/p', scriptToken];

    // Debug visibility for the exact arguments passed into the module
    console.log('[clownassembler] callMain args:', JSON.stringify(args));

    // Call into the module via callMain if available
    let exitCode: number | null = null;
    if (typeof wasmModule.callMain === 'function') {
      try {
        try { wasmModule.arguments = args; } catch {}
        const result = wasmModule.callMain(args);
        if (typeof result === 'number') {
          exitCode = result;
        }
      } catch (e: any) {
        // emscripten may throw an ExitStatus with a status code
        if (e && typeof e.status === 'number') {
          exitCode = e.status;
        }
      }
    } else if (typeof wasmModule.run === 'function') {
      wasmModule.arguments = args;
      wasmModule.run();
    } else {
      throw new Error('No callMain/run found on wasm module');
    }

    // If exit code is non-zero, assembly failed - show all output
    if (exitCode !== null && exitCode !== 0) {
      const output = getCapturedOutput();
      const outputText = output.filter(line => line.trim().length > 0).join('\n');
      throw new Error(`Assembly failed:\n${outputText}`);
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
    
    // No output file was produced - show all output as error
    const output = getCapturedOutput();
    if (output.length > 0) {
      const outputText = output.filter(line => line.trim().length > 0).join('\n');
      throw new Error(`Assembly failed:\n${outputText}`);
    }
    
    throw new Error('Assembly produced no output file. Check the console for details.');
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