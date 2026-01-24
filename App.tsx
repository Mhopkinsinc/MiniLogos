import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import SidebarControls from './components/SidebarControls';
import Workspace from './components/Workspace';
import { PatcherMode, PatchConfig, RomFile } from './types';
import { patchRom, readFileAsArrayBuffer } from './services/patcherService';
import { Icon } from './components/Icons';

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState('Preview');

  // App State
  const [currentFile, setCurrentFile] = useState<RomFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  const [config, setConfig] = useState<PatchConfig>({
    mode: PatcherMode.FullBanners,
    options: {
      enableTeamSelectBanners: true,
      enableInGameBanners: true,
      enablePlayoffBanners: true,
      enableMiniLogos: true
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
      const patchedBlob = await patchRom(buffer, config);
      const url = URL.createObjectURL(patchedBlob);
      setDownloadUrl(url);
    } catch (err) {
      console.error(err);
      setError("An error occurred while patching the ROM.");
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
          fileLoaded={!!currentFile} 
          onReset={handleReset}
          showInstructions={showInstructions}
          onCloseInstructions={() => setShowInstructions(false)}
        />
      );
    } else if (activeTab === 'About') {
      return (
        <div className="max-w-2xl text-slate-400 text-sm leading-relaxed p-8">
            <h2 className="text-xl font-bold text-white mb-4">About NHL '94 Patcher</h2>
            <p className="mb-4">This tool allows you to inject original NHL '92 assets into the Genesis version of NHL '94. It runs entirely in your browser using WebAssembly, ensuring no files are uploaded to a server.</p>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded">
                <h3 className="text-white font-bold mb-2">Legal Disclaimer</h3>
                <p>This is an unofficial utility. Please use with legally obtained ROM dumps only. EA Sports and NHL are trademarks of their respective owners.</p>
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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded shadow-lg text-sm font-semibold flex items-center animate-fade-in-down">
          <span className="mr-2">⚠️</span> {error}
          <button onClick={() => setError(null)} className="ml-4 hover:text-red-200">✕</button>
        </div>
      )}
      
      {renderContent()}
    </Layout>
  );
};

export default App;