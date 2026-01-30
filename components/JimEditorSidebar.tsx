import React, { useRef } from 'react';
import { Icon } from './Icons';
import { JimData, parseJimFile, createJimFile, createAsepriteBlob, generateMetadata, updateJimFromImage } from '../services';
import { parseAseprite, convertAsepriteToJim } from '../services';
import type { ViewMode } from './JimEditor';

interface JimEditorSidebarProps {
  jimData: JimData | null;
  jimFilename: string;
  onJimLoad: (data: JimData, filename: string) => void;
  viewMode: ViewMode;
  selectedPalette: number;
  onPaletteChange: (palette: number) => void;
  transparentBg: boolean;
  onTransparentBgChange: (value: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  setError: (error: string | null) => void;
}

// Reusable UI Components (matching SidebarControls style)
const Toggle: React.FC<{ label: string; checked: boolean; onChange: () => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
  <div className={`flex items-center justify-between py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <span className="text-sm text-slate-300 font-medium">{label}</span>
    <button
      onClick={onChange}
      className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-slate-900 focus:ring-blue-500 ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
    >
      <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform duration-200 ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  </div>
);

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
  transparentBg,
  onTransparentBgChange,
  isProcessing,
  setIsProcessing,
  setError
}) => {
  const jimInputRef = useRef<HTMLInputElement>(null);
  const aseInputRef = useRef<HTMLInputElement>(null);
  const pngInputRef = useRef<HTMLInputElement>(null);

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

  const handlePngImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !jimData) return;

    setIsProcessing(true);
    setError(null);
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      URL.revokeObjectURL(url);
      
      const updatedJim = updateJimFromImage(jimData, imageData);
      onJimLoad(updatedJim, jimFilename);
    } catch (err) {
      console.error('Failed to import PNG:', err);
      setError(err instanceof Error ? err.message : 'Failed to import PNG');
    } finally {
      setIsProcessing(false);
      if (pngInputRef.current) pngInputRef.current.value = '';
    }
  };

  // --- Export Handlers ---
  const handleExportJim = () => {
    if (!jimData) return;
    const bytes = createJimFile(jimData);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    downloadBlob(blob, jimFilename || 'export.jim');
  };

  const handleExportAseprite = async (mode: 'map' | 'tileset') => {
    if (!jimData) return;
    setIsProcessing(true);
    try {
      const palIdx = selectedPalette === -1 ? -1 : selectedPalette;
      const blob = await createAsepriteBlob(jimData, mode, palIdx, transparentBg);
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

  const handleExportPng = () => {
    if (!jimData) return;
    // Get the canvas from the editor (we'll render to a temp canvas)
    const canvas = document.createElement('canvas');
    const { renderMapToCanvas, renderTilesetToCanvas } = require('../services');
    
    if (viewMode === 'map') {
      const forcePal = selectedPalette === -1 ? undefined : selectedPalette;
      renderMapToCanvas(jimData, canvas, forcePal, transparentBg);
    } else {
      const palIdx = selectedPalette === -1 ? 0 : selectedPalette;
      renderTilesetToCanvas(jimData, canvas, palIdx, 1, transparentBg);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const suffix = viewMode === 'map' ? '_map' : '_tileset';
        const filename = jimFilename.replace(/\.jim$/i, '') + suffix + '.png';
        downloadBlob(blob, filename);
      }
    }, 'image/png');
  };

  const handleExportJson = () => {
    if (!jimData) return;
    const metadata = generateMetadata(jimData);
    const json = JSON.stringify(metadata, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = jimFilename.replace(/\.jim$/i, '') + '_metadata.json';
    downloadBlob(blob, filename);
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

  return (
    <div className="flex flex-col h-full relative">
      {/* Hidden File Inputs */}
      <input type="file" ref={jimInputRef} onChange={handleJimFileLoad} className="hidden" accept=".jim" />
      <input type="file" ref={aseInputRef} onChange={handleAsepriteFileLoad} className="hidden" accept=".ase,.aseprite" />
      <input type="file" ref={pngInputRef} onChange={handlePngImport} className="hidden" accept=".png" />

      {/* Load File Section */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <SectionHeader icon="upload" title="Load File" color="text-indigo-400" />
        <div className="space-y-2">
          <ActionButton 
            icon="file" 
            label="Load .jim File" 
            onClick={() => jimInputRef.current?.click()}
            disabled={isProcessing}
          />
          <ActionButton 
            icon="layers" 
            label="Load .aseprite File" 
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
          <SectionHeader icon="palette" title="Palette" color="text-amber-400" />
          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={() => onPaletteChange(-1)}
              className={`px-2 py-2 rounded text-xs font-medium transition-all border ${
                selectedPalette === -1 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
              title="Use native palette per cell (Map mode only)"
            >
              Native
            </button>
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

        {/* Display Options */}
        <div className="p-5 border-b border-slate-800">
          <SectionHeader icon="settings" title="Display" color="text-emerald-400" />
          <Toggle 
            label="Transparent Background" 
            checked={transparentBg} 
            onChange={() => onTransparentBgChange(!transparentBg)} 
          />
        </div>

        {/* Export Actions */}
        <div className="p-5 border-b border-slate-800">
          <SectionHeader icon="download" title="Export" color="text-rose-400" />
          <div className="space-y-2">
            <ActionButton 
              icon="download" 
              label="Export .jim" 
              onClick={handleExportJim}
              disabled={!jimData || isProcessing}
              variant="primary"
            />
            <ActionButton 
              icon="layers" 
              label="Export Aseprite (Map)" 
              onClick={() => handleExportAseprite('map')}
              disabled={!jimData || isProcessing}
            />
            <ActionButton 
              icon="layers" 
              label="Export Aseprite (Tileset)" 
              onClick={() => handleExportAseprite('tileset')}
              disabled={!jimData || isProcessing}
            />
            <ActionButton 
              icon="image" 
              label="Export PNG" 
              onClick={handleExportPng}
              disabled={!jimData || isProcessing}
            />
            <ActionButton 
              icon="file" 
              label="Export JSON Metadata" 
              onClick={handleExportJson}
              disabled={!jimData || isProcessing}
            />
          </div>
        </div>

        {/* Import (Round-trip) */}
        <div className="p-5">
          <SectionHeader icon="upload" title="Import (Round-trip)" color="text-violet-400" />
          <p className="text-xs text-slate-500 mb-3">
            Import a PNG to regenerate tiles while preserving palettes.
          </p>
          <ActionButton 
            icon="image" 
            label="Import PNG" 
            onClick={() => pngInputRef.current?.click()}
            disabled={!jimData || isProcessing}
          />
        </div>
      </div>
    </div>
  );
};

export default JimEditorSidebar;
