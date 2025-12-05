import React from 'react';
import { FolderOpen, Plus, Server as ServerIcon, Globe, Briefcase } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface EmptyStateProps {
  lang: Language;
  onAddServer: () => void;
  onAddDomain: () => void;
  onAddProvider: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ lang, onAddServer, onAddDomain, onAddProvider }) => {
  const t = translations[lang];
  return (
    <div className="w-full min-h-[50vh] flex items-center justify-center">
      <div className="text-center max-w-xl mx-auto p-6">
        <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 mb-4">
          <FolderOpen className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
        <div className="space-y-2">
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{t.emptyTitle}</div>
          <div className="text-slate-500 text-sm sm:text-base">{t.emptyHint}</div>
        </div>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={onAddServer} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
            <ServerIcon className="w-4 h-4" />{t.addServer}
          </button>
          <button onClick={onAddDomain} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
            <Globe className="w-4 h-4" />{t.addDomain}
          </button>
          <button onClick={onAddProvider} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
            <Briefcase className="w-4 h-4" />{t.addProvider}
          </button>
        </div>
        <div className="mt-3 text-[12px] text-slate-500 flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" />
          <span>{t.emptyActionsHint || ''}</span>
        </div>
      </div>
    </div>
  );
};

