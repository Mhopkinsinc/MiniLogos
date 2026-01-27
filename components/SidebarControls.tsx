import React from 'react';
import { PatcherMode, PatchConfig, PatchOptions, RomFile } from '../types';
import FileUpload from './FileUpload';
import { Icon } from './Icons';

interface SidebarControlsProps {
  config: PatchConfig;
  onConfigChange: (newConfig: PatchConfig) => void;
  currentFile: RomFile | null;
  onFileSelect: (file: RomFile) => void;
  onPatch: () => void;
  isProcessing: boolean;
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: () => void; disabled?: boolean; tooltip?: string }> = ({ label, checked, onChange, disabled, tooltip }) => (
  <div className={`flex items-center justify-between py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <span className="text-sm text-slate-300 font-medium flex items-center gap-1.5">
      {label}
      {tooltip && (
        <span className="relative group">
          <Icon name="info" className="w-3.5 h-3.5 text-slate-500 cursor-help" />
          <span className="absolute left-0 bottom-full mb-2 px-2 py-1 text-xs text-slate-200 bg-slate-800 border border-slate-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            {tooltip}
          </span>
        </span>
      )}
    </span>
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

const SidebarControls: React.FC<SidebarControlsProps> = ({ 
  config, 
  onConfigChange, 
  currentFile, 
  onFileSelect, 
  onPatch, 
  isProcessing 
}) => {

  const handleModeChange = (mode: PatcherMode) => {
    let newOptions: PatchOptions;
    if (mode === PatcherMode.MiniLogosOnly) {
      newOptions = {
        enableTeamSelectBanners: false,
        enableInGameBanners: false,
        enablePlayoffBanners: false,
        enableMiniLogos: true,
        use32Teams: false
      };
    } else {
      newOptions = {
        enableTeamSelectBanners: true,
        enableInGameBanners: true,
        enablePlayoffBanners: true,
        enableMiniLogos: true,
        use32Teams: false
      };
    }
    onConfigChange({ mode, options: newOptions });
  };

  const handleOptionToggle = (key: keyof PatchOptions) => {
    if (config.mode === PatcherMode.MiniLogosOnly) return;
    onConfigChange({
      ...config,
      options: { ...config.options, [key]: !config.options[key] }
    });
  };

  // Logic to determine if patch button should be disabled
  const hasFeaturesEnabled = Object.values(config.options).some(Boolean);
  const isApplyDisabled = !currentFile || isProcessing || !hasFeaturesEnabled;

  return (
    <div className="flex flex-col h-full">
      {/* File Operations */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/50">
        <SectionHeader icon="file" title="1. ROM File" color="text-indigo-400" />
        <div className={!currentFile ? 'animate-pulse' : ''}>
          <FileUpload currentFile={currentFile} onFileSelect={onFileSelect} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Core Mode */}
        <div className="p-5 border-b border-slate-800">
          <SectionHeader icon="cpu" title="2. Patch Mode" color="text-sky-400" />
          <div className="space-y-2">
            <button
              onClick={() => handleModeChange(PatcherMode.FullBanners)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all border relative overflow-hidden group ${
                config.mode === PatcherMode.FullBanners 
                  ? 'bg-blue-600/10 border-blue-500/50 text-white shadow-[0_0_15px_rgba(37,99,235,0.15)]' 
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div className="relative z-10">
                <div className="font-bold">Banners & Mini Logos</div>
                <div className={`text-xs mt-1 ${config.mode === PatcherMode.FullBanners ? 'text-blue-200' : 'text-slate-500'}`}>Configure Banners and Mini Logos</div>
                <div className={`text-xs mt-1 ${config.mode === PatcherMode.FullBanners ? 'text-blue-200' : 'text-slate-500'}`}>28 Team ROMs only</div>
              </div>
              {config.mode === PatcherMode.FullBanners && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div></div>}
            </button>
            <button
              onClick={() => handleModeChange(PatcherMode.MiniLogosOnly)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all border relative overflow-hidden group ${
                config.mode === PatcherMode.MiniLogosOnly 
                  ? 'bg-blue-600/10 border-blue-500/50 text-white shadow-[0_0_15px_rgba(37,99,235,0.15)]' 
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div className="relative z-10">
                <div className="font-bold">Mini Logos Only</div>
                <div className={`text-xs mt-1 ${config.mode === PatcherMode.MiniLogosOnly ? 'text-blue-200' : 'text-slate-500'}`}>Gameplay Mini Logos</div>
                <div className={`text-xs mt-1 ${config.mode === PatcherMode.MiniLogosOnly ? 'text-blue-200' : 'text-slate-500'}`}>28/30/32 Team ROMs</div>
              </div>
              {config.mode === PatcherMode.MiniLogosOnly && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div></div>}
            </button>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="p-5">
          <SectionHeader icon="layers" title="3. Features" color="text-amber-400" />
          <div className="space-y-1 bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
            {config.mode === PatcherMode.FullBanners && (
              <>
                <Toggle 
                  label="Team Select Banners" 
                  checked={config.options.enableTeamSelectBanners} 
                  onChange={() => handleOptionToggle('enableTeamSelectBanners')} 
                />
                <Toggle 
                  label="In-Game Banners" 
                  checked={config.options.enableInGameBanners} 
                  onChange={() => handleOptionToggle('enableInGameBanners')} 
                />
                <Toggle 
                  label="Playoff Brackets" 
                  checked={config.options.enablePlayoffBanners} 
                  onChange={() => handleOptionToggle('enablePlayoffBanners')} 
                />
                <Toggle 
                  label="Mini Logos" 
                  checked={config.options.enableMiniLogos} 
                  onChange={() => handleOptionToggle('enableMiniLogos')} 
                />
              </>
            )}
            {config.mode === PatcherMode.MiniLogosOnly && (
              <Toggle 
                label="30/32 Team ROM" 
                checked={config.options.use32Teams} 
                onChange={() => onConfigChange({
                  ...config,
                  options: { ...config.options, use32Teams: !config.options.use32Teams }
                })}
                tooltip="Enable 30/32 Team ROMs."
              />
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-5 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
        <button
          onClick={onPatch}
          disabled={isApplyDisabled}
          className={`
            w-full flex items-center justify-center py-3.5 rounded-lg font-bold text-sm transition-all shadow-xl uppercase tracking-wider
            ${isApplyDisabled
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/50 shadow-blue-900/20 active:scale-[0.98] ring-1 ring-white/10'
            }
          `}
        >
          {isProcessing ? (
             <span className="flex items-center">
               <Icon name="refresh" className="w-4 h-4 mr-2 animate-spin" /> PROCESSING...
             </span>
          ) : (
             <span className="flex items-center">
               <Icon name="download" className="w-4 h-4 mr-2" /> APPLY PATCH
             </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default SidebarControls;