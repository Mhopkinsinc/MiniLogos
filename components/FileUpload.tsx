import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RomFile } from '../types';
import { Icon } from './Icons';

interface FileUploadProps {
  onFileSelect: (file: RomFile) => void;
  currentFile: RomFile | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, currentFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the file input when currentFile is cleared (e.g., after "Patch New File")
  // This ensures the same file can be selected again
  useEffect(() => {
    if (!currentFile && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [currentFile]);

  const handleDrag = useCallback((e: React.DragEvent, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(dragging);
  }, []);

  const processFile = (file: File) => {
    onFileSelect({
      name: file.name,
      size: file.size,
      data: file
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    handleDrag(e, false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={(e) => handleDrag(e, true)}
        onDragOver={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 group
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : currentFile 
              ? 'border-green-600/50 bg-green-500/5' 
              : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'
          }
        `}
      >
        <input
          type="file"
          ref={inputRef}
          onChange={handleInputChange}
          className="hidden"
          accept=".bin,.md,.smd,.gen"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          {currentFile ? (
            <>
              <div className="w-10 h-10 bg-green-600 rounded flex items-center justify-center shadow-lg shadow-green-900/50">
                <Icon name="check" className="w-5 h-5 text-white" />
              </div>
              <div className="text-left w-full overflow-hidden">
                <h3 className="text-xs font-bold text-green-400 truncate text-center">{currentFile.name}</h3>
                <p className="text-[10px] text-slate-500 text-center uppercase mt-1">Ready to Patch</p>
              </div>
            </>
          ) : (
            <>
              <div className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${isDragging ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                <Icon name="upload" className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-300 group-hover:text-white">
                  Drop or Upload ROM File
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  .bin, .md supported
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;