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

interface JimEditorSidebarProps {
  jimData: JimData | null;
  jimFilename: string;
  onJimLoad: (data: JimData, filename: string) => void;
  viewMode: ViewMode;
  selectedPalette: number;
  onPaletteChange: (palette: number) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  setError: (error: string | null) => void;
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

const JimEditorSidebar: React.FC<JimEditorSidebarProps> = ({
  jimData,
  jimFilename,
  onJimLoad,
  viewMode,
  selectedPalette,
  onPaletteChange,
  isProcessing,
  setIsProcessing,
  setError
}) => {
  const jimInputRef = useRef<HTMLInputElement>(null);
  const aseInputRef = useRef<HTMLInputElement>(null);
  const [presetJimFiles, setPresetJimFiles] = useState<{ label: string; path: string }[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPresetList = async () => {
      setIsLoadingPresets(true);
      try {
        const response = await fetch('wasm/scripts/list.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch preset list (${response.status})`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload)) {
          throw new Error('Unexpected preset list format');
        }

        const jimEntries = payload
          .filter((entry): entry is string => typeof entry === 'string')
          .filter((entry) => entry.toLowerCase().startsWith('minilogos/') && entry.toLowerCase().endsWith('.jim'))
          .map((entry) => {
            const filename = entry.split('/').pop() || entry;
            return {
              label: filename,
              path: `wasm/scripts/${entry.replace(/^\//, '')}`
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

  // --- File Load Handlers ---
  const handleJimFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const data = parseJimFile(buffer);
      onJimLoad(data, file.name);
    } catch (err) {
      console.error('Failed to parse JIM file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse JIM file');
    } finally {
      setIsProcessing(false);
      if (jimInputRef.current) jimInputRef.current.value = '';
    }
  };

  const handleAsepriteFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const aseData = await parseAseprite(buffer);
      const data = convertAsepriteToJim(aseData, false); // false = enable deduplication
      onJimLoad(data, file.name.replace(/\.(ase|aseprite)$/i, '.jim'));
    } catch (err) {
      console.error('Failed to parse Aseprite file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse Aseprite file');
    } finally {
      setIsProcessing(false);
      if (aseInputRef.current) aseInputRef.current.value = '';
    }
  };

  const handlePresetJimLoad = async (file: { label: string; path: string }) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(file.path);
      if (!response.ok) {
        throw new Error(`Failed to load ${file.label}`);
      }

      const buffer = await response.arrayBuffer();
      const data = parseJimFile(buffer);
      onJimLoad(data, file.label);
    } catch (err) {
      console.error('Failed to load preset JIM file:', err);
      setError(err instanceof Error ? err.message : `Unable to load ${file.label}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Export Handlers ---
  const handleExportJim = () => {
    if (!jimData) return;
    const bytes = createJimFile(jimData);
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
    downloadBlob(blob, jimFilename || 'export.jim');
  };

  const handleExportAseprite = async (mode: 'map' | 'tileset') => {
    if (!jimData) return;
    setIsProcessing(true);
    try {
      const palIdx = selectedPalette === -1 ? -1 : selectedPalette;
      const blob = await createAsepriteBlob(jimData, mode, palIdx, true);
      const suffix = mode === 'map' ? '_map' : '_tileset';
      const filename = jimFilename.replace(/\.jim$/i, '') + suffix + '.aseprite';
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export Aseprite:', err);
      setError(err instanceof Error ? err.message : 'Failed to export Aseprite file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPng = async () => {
    if (!jimData) return;

    setIsProcessing(true);
    setError(null);

    try {
      const canvas = document.createElement('canvas');

      if (viewMode === 'map') {
        renderMapToCanvas(jimData, canvas, selectedPalette, true);
      } else if (viewMode === 'tileset') {
        renderTilesetToCanvas(jimData, canvas, selectedPalette, 1, true);
      } else {
        renderPalettesToCanvas(jimData, canvas);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );

      if (blob) {
        const suffix = viewMode === 'map' ? '_map' : viewMode === 'tileset' ? '_tileset' : '_palettes';
        const filename = jimFilename.replace(/\.jim$/i, '') + suffix + '.png';
        downloadBlob(blob, filename);
        return;
      }

      const dataUrl = canvas.toDataURL('image/png');
      downloadDataUrl(dataUrl, viewMode);
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

  const downloadDataUrl = (dataUrl: string, mode: ViewMode) => {
    const a = document.createElement('a');
    const suffix = mode === 'map' ? '_map' : mode === 'tileset' ? '_tileset' : '_palettes';
    a.href = dataUrl;
    a.download = jimFilename.replace(/\.jim$/i, '') + suffix + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Hidden File Inputs */}
      <input type="file" ref={jimInputRef} onChange={handleJimFileLoad} className="hidden" accept=".jim" />
      <input type="file" ref={aseInputRef} onChange={handleAsepriteFileLoad} className="hidden" accept=".ase,.aseprite" />

      {/* Preset Files Section */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/70 shrink-0">
        <SectionHeader icon="layers" title="Preset Files" color="text-emerald-400" />
        <div className="space-y-2">
          {presetJimFiles.map((file) => (
            <ActionButton
              key={file.path}
              icon="file"
              label={file.label}
              onClick={() => handlePresetJimLoad(file)}
              disabled={isProcessing}
              variant={jimFilename === file.label ? 'primary' : 'secondary'}
            />
          ))}
          {isLoadingPresets && (
            <p className="text-xs text-slate-500">Loading presets...</p>
          )}
          {!isLoadingPresets && presetJimFiles.length === 0 && (
            <p className="text-xs text-slate-600">No preset .jim files found.</p>
          )}
        </div>
      </div>

      {/* Import File Section */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <SectionHeader icon="upload" title="Import File" color="text-indigo-400" />
        <div className="space-y-2">
          <ActionButton 
            icon="layers" 
            label="Import .aseprite File" 
            onClick={() => aseInputRef.current?.click()}
            disabled={isProcessing}
          />
        </div>
        {jimData && (
          <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-xs text-green-400 font-mono truncate">{jimFilename}</p>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
        
        {/* Palette Selection */}
        <div className="p-5 border-b border-slate-800">
          <SectionHeader icon="palette" title="Genesis Palette" color="text-amber-400" />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(i => (
              <button
                key={i}
                onClick={() => onPaletteChange(i)}
                className={`px-3 py-2 rounded text-xs font-mono font-bold transition-all border ${
                  selectedPalette === i 
                    ? 'bg-blue-600 border-blue-500 text-white' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Export Actions */}
        <div className="p-5 border-b border-slate-800">
          <SectionHeader icon="download" title="Export" color="text-rose-400" />
          <div className="space-y-2">
            <ActionButton 
              icon="layers" 
              label="Export .aseprite" 
              onClick={() => handleExportAseprite('map')}
              disabled={!jimData || isProcessing}
            />
            <ActionButton 
              icon="download" 
              label="Export .jim" 
              onClick={handleExportJim}
              disabled={!jimData || isProcessing}
              variant="primary"
            />
            <ActionButton 
              icon="image" 
              label="Export PNG" 
              onClick={handleExportPng}
              disabled={!jimData || isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JimEditorSidebar;
