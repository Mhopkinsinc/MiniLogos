import React from 'react';
import { Icon } from './Icons';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  sidebar: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, sidebar }) => {
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center space-x-3 w-80">          
          <h1 className="text-sm font-bold tracking-tight text-slate-100">
            NHL '94 Team Banners + Mini Logos Patcher
          </h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex-1 flex justify-center">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {['Preview', 'About'].map((tab) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={`
                  px-6 py-1.5 text-xs font-medium rounded-md transition-all
                  ${activeTab === tab 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}
                `}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Utility Actions - Kept empty container to balance the flex layout */}
        <div className="flex items-center space-x-2 w-80 justify-end">
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10">
          {sidebar}
        </aside>

        {/* Right Content Area (Canvas) */}
        <main className="flex-1 bg-slate-950 relative overflow-auto flex items-center justify-center p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;