import React, { useState, useCallback, useEffect } from 'react';
import { Icon } from './Icons';

interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ isOpen, onClose }) => {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FSEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const getFS = useCallback(() => {
    const wasmModule = (window as any).__clownAssemblerModule;
    return wasmModule?.FS || null;
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-99), `[${timestamp}] ${message}`]);
  }, []);

  const refreshDirectory = useCallback(() => {
    const FS = getFS();
    if (!FS) {
      setError('WASM module not loaded. Load a ROM file first to initialize the filesystem.');
      setEntries([]);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const contents = FS.readdir(currentPath) as string[];
      const fsEntries: FSEntry[] = contents
        .filter((name: string) => name !== '.' && name !== '..')
        .map((name: string) => {
          const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
          try {
            const stat = FS.stat(fullPath);
            const isDir = FS.isDir(stat.mode);
            return {
              name,
              path: fullPath,
              isDirectory: isDir,
              size: isDir ? undefined : stat.size,
            };
          } catch {
            return { name, path: fullPath, isDirectory: false };
          }
        })
        .sort((a: FSEntry, b: FSEntry) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      setEntries(fsEntries);
      addLog(`Listed ${fsEntries.length} entries in ${currentPath}`);
    } catch (e: any) {
      setError(`Failed to read directory: ${e.message}`);
      addLog(`Error reading ${currentPath}: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, getFS, addLog]);

  useEffect(() => {
    if (isOpen) {
      refreshDirectory();
    }
  }, [isOpen, currentPath, refreshDirectory]);

  const navigateTo = (path: string) => {
    setSelectedFile(null);
    setFileContent(null);
    setCurrentPath(path);
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    navigateTo(parts.length === 0 ? '/' : '/' + parts.join('/'));
  };

  const viewFile = (path: string) => {
    const FS = getFS();
    if (!FS) return;

    setSelectedFile(path);
    try {
      // Try to read as text first
      const data = FS.readFile(path, { encoding: 'utf8' }) as string;
      if (data.length > 10000) {
        setFileContent(data.substring(0, 10000) + '\n\n... (truncated, file too large)');
      } else {
        setFileContent(data);
      }
      addLog(`Viewed file: ${path}`);
    } catch {
      // If text fails, show binary info
      try {
        const data = FS.readFile(path, { encoding: 'binary' }) as Uint8Array;
        const hex = Array.from(data.slice(0, 256))
          .map((b: number) => b.toString(16).padStart(2, '0'))
          .join(' ');
        setFileContent(`[Binary file, ${data.length} bytes]\n\nFirst 256 bytes (hex):\n${hex}`);
        addLog(`Viewed binary file: ${path} (${data.length} bytes)`);
      } catch (e: any) {
        setFileContent(`Error reading file: ${e.message}`);
        addLog(`Error reading file ${path}: ${e.message}`);
      }
    }
  };

  const downloadFile = (path: string) => {
    const FS = getFS();
    if (!FS) return;

    try {
      const data = FS.readFile(path, { encoding: 'binary' }) as Uint8Array;
      // Create ArrayBuffer from data to avoid SharedArrayBuffer type issues
      const arrayBuffer = new ArrayBuffer(data.length);
      new Uint8Array(arrayBuffer).set(data);
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'file';
      a.click();
      URL.revokeObjectURL(url);
      addLog(`Downloaded: ${path}`);
    } catch (e: any) {
      setError(`Failed to download: ${e.message}`);
      addLog(`Error downloading ${path}: ${e.message}`);
    }
  };

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-[900px] max-w-[95vw] h-[700px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">🐛</span>
            <h2 className="text-sm font-bold text-white">WASM Filesystem Debug</h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">DEV MODE</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900">
          <button
            onClick={goUp}
            disabled={currentPath === '/'}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            ⬆️ Up
          </button>
          <button
            onClick={refreshDirectory}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
          >
            🔄 Refresh
          </button>
          <div className="flex-1 px-3 py-1 bg-slate-950 rounded font-mono text-xs text-slate-300">
            {currentPath}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Browser */}
          <div className="w-1/2 border-r border-slate-800 flex flex-col">
            <div className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-850 border-b border-slate-800">
              Files & Directories
            </div>
            <div className="flex-1 overflow-auto">
              {error && (
                <div className="p-3 text-xs text-amber-400 bg-amber-900/20 border-b border-amber-900/30">
                  ⚠️ {error}
                </div>
              )}
              {isLoading ? (
                <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
              ) : entries.length === 0 && !error ? (
                <div className="p-4 text-center text-slate-500 text-sm">Directory is empty</div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {entries.map((entry) => (
                    <div
                      key={entry.path}
                      className={`flex items-center px-3 py-2 text-xs cursor-pointer hover:bg-slate-800/50 transition-colors ${
                        selectedFile === entry.path ? 'bg-blue-900/30' : ''
                      }`}
                      onClick={() => {
                        if (entry.isDirectory) {
                          navigateTo(entry.path);
                        } else {
                          viewFile(entry.path);
                        }
                      }}
                    >
                      <span className="mr-2">{entry.isDirectory ? '📁' : '📄'}</span>
                      <span className="flex-1 truncate font-mono">{entry.name}</span>
                      <span className="text-slate-500 ml-2">{formatSize(entry.size)}</span>
                      {!entry.isDirectory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(entry.path);
                          }}
                          className="ml-2 text-blue-400 hover:text-blue-300"
                          title="Download"
                        >
                          ⬇️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* File Preview / Logs */}
          <div className="w-1/2 flex flex-col">
            <div className="flex border-b border-slate-800">
              <div className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-850 flex-1">
                {selectedFile ? `Preview: ${selectedFile.split('/').pop()}` : 'Activity Log'}
              </div>
              {selectedFile && (
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setFileContent(null);
                  }}
                  className="px-2 text-xs text-slate-500 hover:text-white"
                >
                  Show Logs
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto p-3 bg-slate-950">
              {selectedFile && fileContent !== null ? (
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
                  {fileContent}
                </pre>
              ) : (
                <div className="text-xs font-mono text-slate-500 space-y-1">
                  {logs.length === 0 ? (
                    <div className="text-slate-600">No activity yet...</div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 text-xs text-slate-500">
          <span>Module loaded: </span>
          <span className={getFS() ? 'text-green-400' : 'text-red-400'}>
            {getFS() ? '✓ Yes' : '✗ No'}
          </span>
          <span className="mx-3">|</span>
          <span>Tip: Load a ROM to initialize the WASM filesystem, then use this panel to inspect files.</span>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;
