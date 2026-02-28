import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import {
  JimData,
  parseJimFile,
  createJimFile,
  createAsepriteBlob,
  parseAseprite,
  convertAsepriteToJim,
  renderMapToCanvas,
  renderTilesetToCanvas,
  renderPalettesToCanvas,
} from '../services';
import type { ViewMode } from './JimEditor';
import type { PresetOverrides } from '../services/patcherService';

// Helper to get asset URL with correct base path for both local dev and GitHub Pages
const getAssetUrl = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path}`;
};

interface JimEditorSidebarProps {
  jimData: JimData | null;
  jimFilename: string;
  onJimLoad: (data: JimData, filename: string) => void;
  viewMode: ViewMode;
  selectedPalette: number;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  setError: (error: string | null) => void;
  presetOverrides: PresetOverrides;
  onPresetOverride: (presetPath: string, jimData: Uint8Array, sourceName: string) => void;
  onClearPresetOverride: (presetPath: string) => void;
  use32Teams: boolean;
}

// Reusable UI Components (matching SidebarControls style)
const SectionHeader: React.FC<{ icon: string; title: string; color?: string }> = ({ icon, title, color = "text-blue-100" }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 shadow-sm">
      <Icon name={icon} className={`w-4 h-4 ${color}`} />
    </div>
    <h3 className={`text-xs font-bold uppercase tracking-widest ${color}`}>{title}</h3>
  </div>
);

const ActionButton: React.FC<{ 
  icon: string; 
  label: string; 
  onClick: () => void; 
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}> = ({ icon, label, onClick, disabled, variant = 'secondary' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
      ${variant === 'primary' 
        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 disabled:bg-slate-700 disabled:text-slate-500' 
        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50'}
      ${disabled ? 'cursor-not-allowed' : 'active:scale-[0.98]'}
    `}
  >
    <Icon name={icon} className="w-4 h-4" />
    {label}
  </button>
);

// Style variants available for presets
type StyleVariant = 'default' | 'drezz' | 'custom';

const JimEditorSidebar: React.FC<JimEditorSidebarProps> = ({
  jimData,
  jimFilename,
  onJimLoad,
  viewMode,
  selectedPalette,
  isProcessing,
  setIsProcessing,
  setError,
  presetOverrides,
  onPresetOverride,
  onClearPresetOverride,
  use32Teams
}) => {
  const aseInputRef = useRef<HTMLInputElement>(null);
  const hasAutoLoadedRef = useRef(false);
  const [presetJimFiles, setPresetJimFiles] = useState<{ label: string; displayName: string; path: string }[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [currentFileSource, setCurrentFileSource] = useState<'preset' | 'aseprite' | 'jim' | null>(null);
  
  // State for style variant selection (default vs DREZZ)
  const [styleVariant, setStyleVariant] = useState<StyleVariant>('default');
  
  // State for export dropdown
  const [openExportDropdown, setOpenExportDropdown] = useState<string | null>(null);
  
  // State for targeted import (when importing for a specific preset)
  const [targetPresetForImport, setTargetPresetForImport] = useState<{ label: string; displayName: string; path: string } | null>(null);

  // Helper to get the path for current style variant
  const getVariantPath = (basePath: string): string => {
    if (styleVariant === 'default' || styleVariant === 'custom') return basePath;
    // Convert "filename.jim" to "filename_drezz.jim"
    return basePath.replace(/\.jim$/i, '_drezz.jim');
  };

  useEffect(() => {
    let active = true;

    const loadPresetList = async () => {
      setIsLoadingPresets(true);
      try {
        const response = await fetch(getAssetUrl('wasm/scripts/list.json'));
        if (!response.ok) {
          throw new Error(`Failed to fetch preset list (${response.status})`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload)) {
          throw new Error('Unexpected preset list format');
        }

        const jimEntries = payload
          .filter((entry): entry is string | { path: string; displayName?: string } => 
            typeof entry === 'string' || (typeof entry === 'object' && entry !== null && 'path' in entry)
          )
          .map((entry) => {
            const entryPath = typeof entry === 'string' ? entry : entry.path;
            const displayName = typeof entry === 'object' && entry.displayName ? entry.displayName : undefined;
            return { entryPath, displayName };
          })
          .filter(({ entryPath }) => entryPath.toLowerCase().startsWith('minilogos/') && entryPath.toLowerCase().endsWith('.jim'))
          .map(({ entryPath, displayName }) => {
            const filename = entryPath.split('/').pop() || entryPath;
            return {
              label: filename,
              displayName: displayName || filename,
              path: getAssetUrl(`wasm/scripts/${entryPath.replace(/^\//, '')}`)
            };
          });

        if (active) {
          setPresetJimFiles(jimEntries);
        }
      } catch (err) {
        console.error('Failed to load preset .jim list', err);
      } finally {
        if (active) {
          setIsLoadingPresets(false);
        }
      }
    };

    loadPresetList();

    return () => {
      active = false;
    };
  }, []);

  // Track currently selected preset for reloading on style variant change
  const [currentPreset, setCurrentPreset] = useState<{ label: string; displayName: string; path: string } | null>(null);

  // Auto-load "Banners (28 Teams)" when presets are loaded and no file is selected
  useEffect(() => {
    if (!isLoadingPresets && presetJimFiles.length > 0 && !jimData && !hasAutoLoadedRef.current) {
      hasAutoLoadedRef.current = true;
      // Find "Banners (28 Teams)" or fall back to the first preset
      const bannersPreset = presetJimFiles.find(f => f.path.includes('banners_28_teams.jim'));
      const presetToLoad = bannersPreset || presetJimFiles[0];
      if (presetToLoad) {
        setCurrentPreset(presetToLoad);
        handlePresetJimLoad(presetToLoad);
      }
    }
  }, [isLoadingPresets, presetJimFiles, jimData]);

  // Reload current preset when style variant changes (skip for 'custom' which uses imports)
  useEffect(() => {
    if (currentPreset && currentFileSource === 'preset' && styleVariant !== 'custom') {
      handlePresetJimLoad(currentPreset);
    }
  }, [styleVariant]);

  // --- File Load Handlers ---
  const handleAsepriteFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const aseData = await parseAseprite(buffer);
      const data = convertAsepriteToJim(aseData, true); // true = no deduplication (unique tiles)
      const filename = file.name.replace(/\.(ase|aseprite)$/i, '.jim');
      
      // Load the data into the editor
      onJimLoad(data, filename);
      setCurrentFileSource('aseprite');

      // If we have a target preset, create the override directly
      if (targetPresetForImport) {
        try {
          const jimBytes = createJimFile(data);
          const relativePath = targetPresetForImport.path.replace(/^.*?wasm\/scripts\//, '');
          onPresetOverride(relativePath, jimBytes, filename);
        } catch (err) {
          console.error('Failed to create JIM override:', err);
          setError(err instanceof Error ? err.message : 'Failed to create preset override');
        }
        setTargetPresetForImport(null);
      }
    } catch (err) {
      console.error('Failed to parse Aseprite file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse Aseprite file');
      setTargetPresetForImport(null);
    } finally {
      setIsProcessing(false);
      if (aseInputRef.current) aseInputRef.current.value = '';
    }
  };

  // Trigger import for a specific preset
  const handleImportForPreset = (file: { label: string; path: string }) => {
    setTargetPresetForImport(file);
    setOpenExportDropdown(null);
    aseInputRef.current?.click();
  };

  const handlePresetJimLoad = async (file: { label: string; displayName: string; path: string }) => {
    setIsProcessing(true);
    setError(null);
    setCurrentPreset(file); // Track current preset for variant switching

    try {
      // Get the path for the current style variant
      const variantPath = getVariantPath(file.path);
      const variantRelativePath = variantPath.replace(/^.*?wasm\/scripts\//, '');
      
      // Check if there's an override for this preset (using variant path)
      const override = presetOverrides.get(variantRelativePath);

      if (override) {
        // Load the override data instead of the original preset
        const data = parseJimFile(override.jimData.buffer);
        onJimLoad(data, override.sourceName || file.label);
        setCurrentFileSource('aseprite');
      } else {
        // Load the preset with the appropriate variant
        const response = await fetch(variantPath);
        if (!response.ok) {
          // If DREZZ variant not found, show helpful error
          if (styleVariant === 'drezz') {
            throw new Error(`DREZZ variant not found for ${file.label}. Expected file: ${variantRelativePath}`);
          }
          throw new Error(`Failed to load ${file.label}`);
        }

        const buffer = await response.arrayBuffer();
        const data = parseJimFile(buffer);
        // Append style indicator to label if using DREZZ
        const displayLabel = styleVariant === 'drezz' ? `${file.label} (DREZZ)` : file.label;
        onJimLoad(data, displayLabel);
        setCurrentFileSource('preset');
      }
    } catch (err) {
      console.error('Failed to load preset JIM file:', err);
      setError(err instanceof Error ? err.message : `Unable to load ${file.label}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Export Handlers ---
  const handleExportJimForPreset = async (file: { label: string; path: string }) => {
    setOpenExportDropdown(null);
    
    // Get the path for the current style variant
    const variantPath = getVariantPath(file.path);
    const variantRelativePath = variantPath.replace(/^.*?wasm\/scripts\//, '');
    const override = presetOverrides.get(variantRelativePath);
    
    if (override) {
      // Export the override data
      const blob = new Blob([override.jimData], { type: 'application/octet-stream' });
      const exportFilename = styleVariant === 'drezz' ? file.label.replace(/\.jim$/i, '_drezz.jim') : file.label;
      downloadBlob(blob, exportFilename);
    } else {
      // Load the preset and export it
      setIsProcessing(true);
      try {
        const response = await fetch(variantPath);
        if (!response.ok) throw new Error(`Failed to load ${file.label}`);
        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const exportFilename = styleVariant === 'drezz' ? file.label.replace(/\.jim$/i, '_drezz.jim') : file.label;
        downloadBlob(blob, exportFilename);
      } catch (err) {
        console.error('Failed to export JIM:', err);
        setError(err instanceof Error ? err.message : 'Failed to export JIM file');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleExportAsepriteForPreset = async (file: { label: string; path: string }) => {
    setOpenExportDropdown(null);
    setIsProcessing(true);
    
    try {
      // Get the path for the current style variant
      const variantPath = getVariantPath(file.path);
      const variantRelativePath = variantPath.replace(/^.*?wasm\/scripts\//, '');
      const override = presetOverrides.get(variantRelativePath);
      
      let data: JimData;
      if (override) {
        // Parse the override data
        data = parseJimFile(override.jimData.buffer);
      } else {
        // Load and parse the preset with variant
        const response = await fetch(variantPath);
        if (!response.ok) throw new Error(`Failed to load ${file.label}`);
        const buffer = await response.arrayBuffer();
        data = parseJimFile(buffer);
      }
      
      // Always use -1 (native mode) to export all 64 colors from all 4 palettes
      const blob = await createAsepriteBlob(data, 'map', -1, true);
      const baseFilename = file.label.replace(/\.jim$/i, '');
      const exportFilename = styleVariant === 'drezz' ? `${baseFilename}_drezz.aseprite` : `${baseFilename}.aseprite`;
      downloadBlob(blob, exportFilename);
    } catch (err) {
      console.error('Failed to export Aseprite:', err);
      setError(err instanceof Error ? err.message : 'Failed to export Aseprite file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPngForPreset = async (file: { label: string; path: string }) => {
    setOpenExportDropdown(null);
    setIsProcessing(true);
    
    try {
      // Get the path for the current style variant
      const variantPath = getVariantPath(file.path);
      const variantRelativePath = variantPath.replace(/^.*?wasm\/scripts\//, '');
      const override = presetOverrides.get(variantRelativePath);
      
      let data: JimData;
      if (override) {
        data = parseJimFile(override.jimData.buffer);
      } else {
        const response = await fetch(variantPath);
        if (!response.ok) throw new Error(`Failed to load ${file.label}`);
        const buffer = await response.arrayBuffer();
        data = parseJimFile(buffer);
      }
      
      const canvas = document.createElement('canvas');
      renderMapToCanvas(data, canvas, selectedPalette, true);
      
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      
      if (blob) {
        const baseFilename = file.label.replace(/\.jim$/i, '');
        const exportFilename = styleVariant === 'drezz' ? `${baseFilename}_drezz.png` : `${baseFilename}.png`;
        downloadBlob(blob, exportFilename);
      }
    } catch (err) {
      console.error('Failed to export PNG:', err);
      setError(err instanceof Error ? err.message : 'Failed to export PNG');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openExportDropdown && !(e.target as Element).closest('.export-dropdown')) {
        setOpenExportDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openExportDropdown]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Hidden File Input */}
      <input type="file" ref={aseInputRef} onChange={handleAsepriteFileLoad} className="hidden" accept=".ase,.aseprite" />

      {/* Preset Files Section */}
      <div className="flex-1 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
        <SectionHeader icon="layers" title="Preset Files" color="text-emerald-400" />
        <p className="text-xs text-slate-500 mb-4">
          Select a preset to view. Use the actions to import custom graphics or export.
        </p>
        
        {/* Style Variant Toggle */}
        <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
              <Icon name="palette" className="w-3.5 h-3.5 text-violet-400" />
              Style Variant
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStyleVariant('default')}
              className={`
                flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all
                ${styleVariant === 'default'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-600'}
              `}
            >
              Default
            </button>
            <button
              onClick={() => setStyleVariant('drezz')}
              className={`
                flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all
                ${styleVariant === 'drezz'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-600'}
              `}
            >
              DREZZ
            </button>
            <button
              onClick={() => setStyleVariant('custom')}
              className={`
                flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all
                ${styleVariant === 'custom'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-600'}
              `}
            >
              Custom
            </button>
          </div>
          {styleVariant === 'default' && (
            <p className="text-[10px] text-emerald-400 mt-2">
              Using '92 style graphics by McMarkis
            </p>
          )}
          {styleVariant === 'drezz' && (
            <p className="text-[10px] text-violet-400 mt-2">
              Using '92 style graphics created by DREZZ
            </p>
          )}
          {styleVariant === 'custom' && (
            <p className="text-[10px] text-amber-400 mt-2">
              Import your own custom graphics
            </p>
          )}
        </div>
        
        {/* Group presets by category */}
        {(() => {
          const bannerFiles = presetJimFiles.filter(f => f.label.toLowerCase().includes('banner'));
          const miniLogoFiles = presetJimFiles.filter(f => f.label.toLowerCase().includes('minilogo'));
          const otherFiles = presetJimFiles.filter(f => 
            !f.label.toLowerCase().includes('banner') && !f.label.toLowerCase().includes('minilogo')
          );
          
          const renderFileGroup = (files: typeof presetJimFiles) => files.map((file) => {
            const relativePath = file.path.replace(/^.*?wasm\/scripts\//, '');
            const override = presetOverrides.get(relativePath);
            const isSelected = jimFilename === file.label || (override && jimFilename === override.sourceName);
            const isDropdownOpen = openExportDropdown === file.path;
            
            // Determine if this preset should be disabled based on team configuration
            const is32TeamPreset = file.label.toLowerCase().includes('32_teams');
            const is28TeamPreset = file.label.toLowerCase().includes('28_teams');
            const isDisabledByTeamConfig = use32Teams ? is28TeamPreset : is32TeamPreset;
            
            return (
              <div 
                key={file.path} 
                className={`
                  relative rounded-lg border transition-all
                  ${isDisabledByTeamConfig 
                    ? 'opacity-40 bg-slate-900/50 border-slate-800' 
                    : isSelected 
                      ? 'bg-blue-600/20 border-blue-500/50' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}
                `}
              >
                {/* Main preset button - click to view */}
                <button
                  onClick={() => handlePresetJimLoad(file)}
                  disabled={isProcessing || isDisabledByTeamConfig}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded-t-lg
                    ${isDisabledByTeamConfig ? 'cursor-not-allowed text-slate-500' : isSelected ? 'text-white' : 'text-slate-300 hover:text-white'}
                    ${isProcessing && !isDisabledByTeamConfig ? 'cursor-not-allowed opacity-50' : ''}
                  `}
                >
                  <Icon name="file" className={`w-4 h-4 ${isDisabledByTeamConfig ? 'text-slate-600' : override ? 'text-amber-400' : 'text-emerald-400'}`} />
                  <span className="flex-1 text-left truncate">{file.displayName}</span>
                  {isDisabledByTeamConfig && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-500 border border-slate-600/30">
                      {use32Teams ? '28 Teams' : '30/32 Teams'}
                    </span>
                  )}
                  {!isDisabledByTeamConfig && override && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Modified
                    </span>
                  )}
                </button>

                {/* Override indicator - only show when not disabled */}
                {!isDisabledByTeamConfig && override && (
                  <div className="px-4 pb-2 flex items-center justify-between">
                    <span className="text-[10px] text-amber-400 truncate" title={override.sourceName}>
                      ⚡ Override: {override.sourceName}
                    </span>
                    <button
                      onClick={() => onClearPresetOverride(relativePath)}
                      className="text-[10px] text-red-400 hover:text-red-300 underline ml-2"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Action buttons row - hide when disabled by team config */}
                {!isDisabledByTeamConfig && (
                <div className="flex items-center gap-2 px-3 pb-3">
                  {/* Import button - only enabled when Custom style is selected */}
                  <button
                    onClick={() => handleImportForPreset(file)}
                    disabled={isProcessing || styleVariant !== 'custom'}
                    title={styleVariant !== 'custom' ? 'Select "Custom" style to enable import' : 'Import custom graphics'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all disabled:cursor-not-allowed ${
                      styleVariant === 'custom'
                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 disabled:opacity-50'
                        : 'bg-slate-800/50 border border-slate-700 text-slate-500 opacity-50'
                    }`}
                  >
                    <Icon name="upload" className="w-3.5 h-3.5" />
                    Import
                  </button>

                  {/* Export dropdown */}
                  <div className="relative export-dropdown">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenExportDropdown(isDropdownOpen ? null : file.path);
                      }}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600/30 hover:text-rose-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="download" className="w-3.5 h-3.5" />
                      Export
                      <Icon name="chevronDown" className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown menu */}
                    {isDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 z-20 bg-slate-900 border border-slate-700 rounded-lg shadow-xl min-w-[140px] py-1">
                        <button
                          onClick={() => handleExportAsepriteForPreset(file)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <Icon name="layers" className="w-3.5 h-3.5 text-purple-400" />
                          .aseprite
                        </button>
                        <button
                          onClick={() => handleExportJimForPreset(file)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <Icon name="file" className="w-3.5 h-3.5 text-emerald-400" />
                          .jim
                        </button>
                        <button
                          onClick={() => handleExportPngForPreset(file)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <Icon name="image" className="w-3.5 h-3.5 text-blue-400" />
                          .png
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>
            );
          });
          
          return (
            <div className="space-y-4">
              {/* Banners Group */}
              {bannerFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Icon name="flag" className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Banners</span>
                    <div className="flex-1 h-px bg-amber-500/30"></div>
                  </div>
                  <div className="space-y-3">
                    {renderFileGroup(bannerFiles)}
                  </div>
                </div>
              )}
              
              {/* Mini Logos Group */}
              {miniLogoFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Icon name="image" className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Mini Logos</span>
                    <div className="flex-1 h-px bg-sky-500/30"></div>
                  </div>
                  <div className="space-y-3">
                    {renderFileGroup(miniLogoFiles)}
                  </div>
                </div>
              )}
              
              {/* Other Files (if any) */}
              {otherFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Icon name="file" className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Other</span>
                    <div className="flex-1 h-px bg-slate-500/30"></div>
                  </div>
                  <div className="space-y-3">
                    {renderFileGroup(otherFiles)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {isLoadingPresets && (
          <p className="text-xs text-slate-500">Loading presets...</p>
        )}
        {!isLoadingPresets && presetJimFiles.length === 0 && (
          <p className="text-xs text-slate-600">No preset .jim files found.</p>
        )}
      </div>

      {/* Currently loaded indicator */}
      {jimData && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-[10px] uppercase tracking-wide text-green-300 mb-1">
              {currentFileSource === 'preset' ? 'Viewing preset' : 'Viewing imported file'}
            </p>
            <p className="text-xs text-green-400 font-mono truncate" title={jimFilename}>{jimFilename}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JimEditorSidebar;
