import React, { useRef, useState } from 'react';
import { Icon } from './Icons';

type InstructionVariant = 'patcher' | 'tile';

interface InstructionsModalProps {
  onClose: () => void;
  variant?: InstructionVariant;
}

const instructionsContent: Record<InstructionVariant, {
  heading: string;
  videoUrl?: string;
  steps: Array<{ title: string; description: string }>;
  altMethod?: { title: string; description: string };
}> = {
  patcher: {
    heading: "Patching Basics",
    videoUrl: 'tutorials/patching-tutorial.mp4',
    steps: [
      {
        title: "Upload ROM",
        description: "Drag & drop a valid NHL '94 Genesis ROM file (.bin, .md).",
      },
      {
        title: "Select Patch Mode",
        description: "Choose between Banners & Mini Logos or Mini Logos only, then toggle specific features.",
      },
      {
        title: "Apply Patch",
        description: "Click the button to process your file and download the patched ROM.",
      },
    ],
  },
  tile: {
    heading: "Custom Tile Editing",
    videoUrl: 'tutorials/tile-editing-tutorial.mp4',
    steps: [
      {
        title: "Select Preset Files to Export",
        description: "Pick a preset banner or logo file to export for editing in Aseprite.",
      },      
      {
        title: "Edit in Aseprite",
        description: "Open the exported .aseprite file, modify the tiles, and save your changes.",
      },
      {
        title: "Re-import Edited File",
        description: "Import your edited Aseprite file back into the app.",
      },
      {
        title: "Apply Patch",
        description: "Switch to the ROM Patcher tab and apply the patch to include your custom tiles.",
      },
    ],
    altMethod: {
      title: "Alternative: Tile Molester",
      description: "You can also edit tiles directly at the end of the patched ROM using Tile Molester if you prefer.",
    },
  },
};

const getVideoUrl = (path?: string) => {
  if (!path) return undefined;
  const base = import.meta.env.BASE_URL || '/';
  // Ensure base ends with slash
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path}`;
};

const InstructionsModal: React.FC<InstructionsModalProps> = ({ onClose, variant = 'patcher' }) => {
  const content = instructionsContent[variant];
  const videoUrl = getVideoUrl(content.videoUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const expandedVideoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const openExpanded = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setIsExpanded(true);
  };

  const closeExpanded = () => {
    if (expandedVideoRef.current) {
      expandedVideoRef.current.pause();
    }
    setIsExpanded(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-[2px]">
      {/* Expanded video lightbox */}
      {isExpanded && videoUrl && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90"
          onClick={closeExpanded}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={closeExpanded}
              className="absolute -top-10 right-0 text-slate-400 hover:text-white transition-colors"
              aria-label="Close expanded video"
            >
              <Icon name="x" className="w-6 h-6" />
            </button>
            <video
              ref={expandedVideoRef}
              src={videoUrl}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl max-w-3xl w-full relative animate-fade-in shadow-black/50">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors z-10"
          aria-label="Close instructions"
        >
          <Icon name="x" className="w-5 h-5" />
        </button>
        
        <div className="flex items-center mb-4 text-blue-400 font-bold tracking-wide">
          <Icon name="info" className="w-5 h-5 mr-2.5" />
          <h2 className="text-sm uppercase">{content.heading}</h2>
        </div>

        <div className="flex gap-5">
          {/* Left side - Video */}
          <div className="flex-shrink-0 w-72">
            {/* Video Tutorial */}
            {videoUrl && !videoError && (
              <div 
                className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-950 cursor-pointer group"
                onClick={openExpanded}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  loop
                  muted
                  playsInline
                  className="w-full h-auto"
                  onError={() => setVideoError(true)}
                />
                {/* Play overlay when paused */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/50 transition-colors">
                    <div className="p-2.5 rounded-full bg-white/20 backdrop-blur-sm">
                      <Icon name="play" className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}
                {/* Expand hint */}
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-slate-900/80 rounded text-[10px] text-slate-400 border border-slate-700">
                  Click to expand
                </div>
              </div>
            )}

            {/* Video placeholder when not yet recorded */}
            {videoUrl && videoError && (
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-6 flex flex-col items-center justify-center text-slate-500 h-40">
                <Icon name="play" className="w-6 h-6 mb-2 opacity-50" />
                <span className="text-xs">Tutorial video coming soon</span>
              </div>
            )}
          </div>

          {/* Right side - Steps */}
          <div className="flex-1 min-w-0">
            <ol className="list-decimal list-inside space-y-2.5 text-sm text-slate-300">
              {content.steps.map((step, index) => (
                <li key={step.title} className="pl-1">
                  <span className="text-slate-100 font-semibold text-xs">{step.title}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5 ml-[-1.25em] pl-[1.25em] leading-relaxed">
                    {step.description}
                  </div>
                </li>
              ))}
            </ol>

            {/* Alternative method callout */}
            {content.altMethod && (
              <div className="mt-3 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-start gap-2">
                  <Icon name="info" className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[11px] font-semibold text-amber-500">{content.altMethod.title}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{content.altMethod.description}</p>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={onClose}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-700 hover:border-slate-600 uppercase tracking-wider"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructionsModal;