import React, { useRef, useLayoutEffect, useState } from 'react';
import { JimData, renderMapToCanvas, renderTilesetToCanvas, renderPalettesToCanvas } from '../services';
import { Icon } from './Icons';

export type ViewMode = 'map' | 'tileset' | 'palettes';

interface JimEditorProps {
  jimData: JimData | null;
  jimFilename: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedPalette: number;
  onPaletteChange: (palette: number) => void;
}

const JimEditor: React.FC<JimEditorProps> = ({ 
  jimData, 
  jimFilename,
  viewMode,
  onViewModeChange,
  selectedPalette,
  onPaletteChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(2);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const transparentBg = true; // Always use transparent background

  // Render main canvas (map, tileset, or palettes)
  useLayoutEffect(() => {
    if (!jimData || !canvasRef.current) return;

    const canvas = canvasRef.current;

    if (viewMode === 'map') {
      // forcePaletteIndex: -1 means use native (per-cell) palettes, otherwise use selected
      const forcePal = selectedPalette === -1 ? undefined : selectedPalette;
      renderMapToCanvas(jimData, canvas, forcePal, transparentBg);
    } else if (viewMode === 'tileset') {
      // Tileset view always uses a specific palette (default to 0 if native selected)
      const palIdx = selectedPalette === -1 ? 0 : selectedPalette;
      renderTilesetToCanvas(jimData, canvas, palIdx, 1, transparentBg);
    } else if (viewMode === 'palettes') {
      renderPalettesToCanvas(jimData, canvas);
    }
    
    // Update canvas size state for proper scaling container
    setCanvasSize(prev => {
      const nextWidth = canvas.width;
      const nextHeight = canvas.height;
      if (prev.width === nextWidth && prev.height === nextHeight) {
        return prev;
      }
      return { width: nextWidth, height: nextHeight };
    });
  }, [jimData, viewMode, selectedPalette, transparentBg]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 1, 8));
  const handleZoomOut = () => setZoom(z => Math.max(z - 1, 1));

  if (!jimData) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-center p-8">
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-10 shadow-2xl shadow-black/50 max-w-md">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
            <Icon name="upload" className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No File Loaded</h2>
          <p className="text-slate-400 text-sm">
            Load a <span className="text-blue-400 font-mono">.jim</span> or <span className="text-purple-400 font-mono">.aseprite</span> file from the sidebar to begin editing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-6 overflow-hidden flex flex-col" ref={containerRef}>
      <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg p-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 rounded-md p-1 border border-slate-800">
            {(['map', 'tileset', 'palettes'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all
                  ${viewMode === mode 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                `}
              >
                <Icon 
                  name={mode === 'map' ? 'image' : mode === 'tileset' ? 'layers' : 'palette'} 
                  className="w-3.5 h-3.5" 
                />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Palette Selection */}
          <div className="flex items-center bg-slate-950 rounded-md p-1 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide px-2">Palette</span>
            {[0, 1, 2, 3].map(i => (
              <button
                key={i}
                onClick={() => onPaletteChange(i)}
                className={`
                  w-7 h-7 flex items-center justify-center text-xs font-mono font-bold rounded transition-all
                  ${selectedPalette === i 
                    ? 'bg-amber-600 text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                `}
              >
                {i}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-950 rounded-md p-1 border border-slate-800">
            <button 
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="flex items-center justify-center px-2 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              <Icon name="zoomOut" className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-white px-2">{zoom}x</span>
            <button 
              onClick={handleZoomIn}
              disabled={zoom >= 8}
              className="flex items-center justify-center px-2 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              <Icon name="zoomIn" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File Info */}
        <div className="mb-4">
          <div className="inline-block bg-slate-900/90 px-3 py-1.5 rounded border border-slate-800 backdrop-blur-sm">
            <p className="text-slate-400 text-xs font-medium">
              <span className="text-slate-300 font-mono">{jimFilename}</span>
              <span className="mx-2 text-slate-600">•</span>
              {jimData.mapWidth}×{jimData.mapHeight} tiles
              <span className="mx-2 text-slate-600">•</span>
              {jimData.tiles.length} unique stamps
            </p>
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 min-h-0 bg-slate-900 rounded-lg border border-slate-800 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
          <div 
            className="p-4 inline-flex items-center justify-center"
            style={{ minWidth: '100%', minHeight: '100%' }}
          >
            <div 
              style={{ 
                width: canvasSize.width * zoom,
                height: canvasSize.height * zoom,
                imageRendering: 'pixelated',
                background: viewMode !== 'palettes' && transparentBg 
                  ? 'repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 50% / 16px 16px' 
                  : '#1f2937'
              }}
            >
              <canvas 
                ref={canvasRef} 
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  imageRendering: 'pixelated'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JimEditor;
