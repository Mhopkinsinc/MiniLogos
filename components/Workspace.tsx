import React from 'react';
import { PatchConfig, PatcherMode } from '../types';
import { TEAM_SELECT_BANNERS_PREVIEW } from '../assets/teamSelectPreview';
import { IN_GAME_BANNERS_PREVIEW } from '../assets/inGamePreview';
import { PLAYOFF_BANNERS_PREVIEW } from '../assets/playoffPreview';
import { MINI_LOGOS_PREVIEW } from '../assets/miniLogosPreview';
import { Icon } from './Icons';

interface WorkspaceProps {
  config: PatchConfig;
  downloadUrl: string | null;
  downloadFilename: string;
  fileLoaded: boolean;
  onReset: () => void;
}

const PreviewCard: React.FC<{ title: string; src: string; active: boolean }> = ({ title, src, active }) => (
  <div className={`
    relative group overflow-hidden rounded-lg border transition-all duration-300
    ${active 
      ? 'border-slate-700 bg-slate-800/50 shadow-xl' 
      : 'border-slate-800/50 bg-slate-900/20 opacity-40 grayscale'}
  `}>
    <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-slate-900/90 to-transparent z-10 flex justify-between items-start">
      <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-slate-950/50 px-2 py-1 rounded backdrop-blur-md border border-slate-800">
        {title}
      </h4>
      {active && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>}
    </div>
    <div className="aspect-video w-full flex items-center justify-center p-4">
      <img 
        src={src} 
        alt={`${title} Preview`} 
        className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105" 
      />
    </div>
  </div>
);

const Workspace: React.FC<WorkspaceProps> = ({ 
  config, 
  downloadUrl,
  downloadFilename,
  fileLoaded, 
  onReset
}) => {

  if (downloadUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto animate-fade-in p-8">
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl p-10 text-center shadow-2xl shadow-black/50">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
             <Icon name="check" className="w-10 h-10 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Patch Applied Successfully</h2>
          <p className="text-slate-400 mb-8 max-w-sm mx-auto">
            Your ROM has been modified with the selected enhancements.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href={downloadUrl} 
              download={downloadFilename}
              className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/40 transition-all active:scale-95"
            >
              <Icon name="download" className="w-5 h-5 mr-2" />
              Download ROM
            </a>
            <button 
              onClick={onReset}
              className="flex items-center justify-center px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg border border-slate-700 transition-all active:scale-95"
            >
              <Icon name="refresh" className="w-4 h-4 mr-2" />
              Patch New File
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Removed the !fileLoaded blocking check to show the workspace immediately.

  return (
    <div className="w-full h-full p-8 overflow-y-auto relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-8">
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">Preview Canvas</h2>
                <div className="inline-block mt-2 bg-slate-900/90 px-3 py-1.5 rounded border border-slate-800 backdrop-blur-sm">
                  <p className="text-slate-400 text-xs font-medium">
                    These are the currently enabled features.
                  </p>
                </div>
            </div>
            <div className="text-xs font-mono text-white font-bold bg-slate-800 px-3 py-1.5 rounded border border-slate-600 shadow-lg mb-0.5">
                MODE: {config.mode}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PreviewCard 
            title="Team Select Screen" 
            src={TEAM_SELECT_BANNERS_PREVIEW} 
            active={config.options.enableTeamSelectBanners} 
          />
          <PreviewCard 
            title="In-Game Scoreboard" 
            src={IN_GAME_BANNERS_PREVIEW} 
            active={config.options.enableInGameBanners} 
          />
          <PreviewCard 
            title="Playoff Brackets" 
            src={PLAYOFF_BANNERS_PREVIEW} 
            active={config.options.enablePlayoffBanners} 
          />
          <PreviewCard 
            title="Mini Logos" 
            src={MINI_LOGOS_PREVIEW} 
            active={config.options.enableMiniLogos} 
          />
        </div>
      </div>
    </div>
  );
};

export default Workspace;