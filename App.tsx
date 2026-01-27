import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import SidebarControls from './components/SidebarControls';
import Workspace from './components/Workspace';
import DebugPanel from './components/DebugPanel';
import { PatcherMode, PatchConfig, RomFile } from './types';
import { patchRom, readFileAsArrayBuffer } from './services/patcherService';
import { Icon } from './components/Icons';

// Check if we're in development mode
const isDev = import.meta.env.DEV;

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState('Preview');
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // App State
  const [currentFile, setCurrentFile] = useState<RomFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('patched.bin');
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  const [config, setConfig] = useState<PatchConfig>({
    mode: PatcherMode.FullBanners,
    options: {
      enableTeamSelectBanners: true,
      enableInGameBanners: true,
      enablePlayoffBanners: true,
      enableMiniLogos: true,
      use32Teams: false
    }
  });

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const handleFileSelect = (file: RomFile) => {
    setCurrentFile(file);
    setDownloadUrl(null);
    setError(null);
  };

  const handlePatch = async () => {
    if (!currentFile) return;

    setIsProcessing(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const buffer = await readFileAsArrayBuffer(currentFile.data);
      const result = await patchRom(buffer, config, currentFile.name);
      const url = URL.createObjectURL(result.blob);
      setDownloadUrl(url);
      setDownloadFilename(result.filename);
    } catch (err) {
      console.error(err);
      // Show the actual error message if available
      const errorMessage = err instanceof Error ? err.message : "An error occurred while patching the ROM.";
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentFile(null);
    setDownloadUrl(null);
    setError(null);
  };

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab === 'Preview') {
      return (
        <Workspace 
          config={config} 
          downloadUrl={downloadUrl}
          downloadFilename={downloadFilename}
          fileLoaded={!!currentFile} 
          onReset={handleReset}
          showInstructions={showInstructions}
          onCloseInstructions={() => setShowInstructions(false)}
        />
      );
    } else if (activeTab === 'About') {
      return (
        <div className="max-w-2xl text-slate-400 text-sm leading-relaxed p-8">
            <h2 className="text-xl font-bold text-white mb-4">About NHL '94 Team Banners + Mini Logos Patcher</h2>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded">
                <h3 className="text-white font-bold mb-2">Disclaimer</h3>
                <p>Please use with legally obtained ROM dumps only. EA Sports and NHL are trademarks of their respective owners.</p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded mt-4">
                <h3 className="text-white font-bold mb-2">Credits</h3>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>
                    <a href="https://github.com/Clownacy/clownassembler" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">clownassembler</a>
                    {" "}- m68k assembler compiled for WebAssembly. (Windows, macOS, Linux).
                  </li>
                  <li>
                    <a href="https://github.com/aseprite/aseprite" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Aseprite</a>
                    {" "}- Animated sprite editor & pixel art tool. (Windows, macOS, Linux).
                  </li>
                </ul>
            </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      sidebar={
        <SidebarControls 
          config={config}
          onConfigChange={setConfig}
          currentFile={currentFile}
          onFileSelect={handleFileSelect}
          onPatch={handlePatch}
          isProcessing={isProcessing}
        />
      }
    >
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-700 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-2xl animate-fade-in-down">
          <div className="flex items-start gap-2">
            <span className="text-red-400 flex-shrink-0">⚠️</span>
            <pre className="whitespace-pre-wrap font-mono text-xs overflow-auto max-h-48">{error}</pre>
            <button onClick={() => setError(null)} className="ml-2 hover:text-red-300 flex-shrink-0">✕</button>
          </div>
        </div>
      )}
      
      {renderContent()}

      {/* Debug Panel - Only shown in dev mode */}
      {isDev && (
        <>
          <button
            onClick={() => setShowDebugPanel(true)}
            className="fixed bottom-4 right-4 z-40 bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 transition-colors"
            title="Open WASM Debug Panel"
          >
            <span>🐛</span> Debug FS
          </button>
          <DebugPanel isOpen={showDebugPanel} onClose={() => setShowDebugPanel(false)} />
        </>
      )}
    </Layout>
  );
};

export default App;