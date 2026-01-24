import React from 'react';
import { Icon } from './Icons';

interface InstructionsModalProps {
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-[2px]">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl max-w-sm w-full relative animate-fade-in shadow-black/50">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
          aria-label="Close instructions"
        >
          <Icon name="x" className="w-5 h-5" />
        </button>
        
        <div className="flex items-center mb-5 text-blue-400 font-bold tracking-wide">
          <Icon name="info" className="w-5 h-5 mr-2.5" />
          <h2 className="text-sm uppercase">Instructions</h2>
        </div>
        
        <ol className="list-decimal list-inside space-y-4 text-sm text-slate-300 ml-1">
          <li className="pl-2">
            <span className="text-slate-100 font-semibold">Upload ROM</span>
            <div className="text-xs text-slate-500 mt-0.5 ml-[-1.5em] pl-[1.5em] leading-relaxed">
              Drag & drop a valid NHL '94 Genesis ROM file (.bin, .md).
            </div>
          </li>
          <li className="pl-2">
            <span className="text-slate-100 font-semibold">Select Patch Mode</span>
            <div className="text-xs text-slate-500 mt-0.5 ml-[-1.5em] pl-[1.5em] leading-relaxed">
              Choose between Banners & Mini Logos or Mini Logos only, then toggle specific features.
            </div>
          </li>
          <li className="pl-2">
            <span className="text-slate-100 font-semibold">Apply Patch</span>
            <div className="text-xs text-slate-500 mt-0.5 ml-[-1.5em] pl-[1.5em] leading-relaxed">
              Click the button to process your file and download the patched ROM.
            </div>
          </li>
        </ol>

        <div className="mt-8">
            <button 
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold py-3 rounded-lg transition-all border border-slate-700 hover:border-slate-600 uppercase tracking-wider"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionsModal;