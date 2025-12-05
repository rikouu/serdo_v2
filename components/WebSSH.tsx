
import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Minus, X, Maximize2, Minimize2 } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Server, Language } from '../types';
import { translations } from '../utils/translations';

interface WebSSHProps {
  server: Server;
  onClose: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  lang: Language;
}

export const WebSSH: React.FC<WebSSHProps> = ({ server, onClose, isMinimized, onToggleMinimize, lang }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const termContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const t = translations[lang];

  const sendResize = () => {
    try { fitRef.current?.fit() } catch {}
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && termRef.current) {
      const cols = termRef.current.cols || 120;
      const rows = termRef.current.rows || 35;
      try { wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows })) } catch {}
    }
  };

  useEffect(() => {
    const useApi = import.meta.env.VITE_USE_API === 'true';
    if (!useApi) return;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1') as string;
    const token = localStorage.getItem('infravault_token') || '';
    const url = base.replace(/^http/, 'ws') + `/ssh?token=${encodeURIComponent(token)}&serverId=${encodeURIComponent(server.id)}`;

    const term = new XTerm({
      fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: { background: '#000000', foreground: '#10b981' },
      cursorBlink: true,
      cursorStyle: 'block',
      cols: 120,
      rows: 35
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;
    if (termContainerRef.current) {
      term.open(termContainerRef.current);
      try { fit.fit() } catch {}
      term.focus();
      setTimeout(() => { try { fitRef.current?.fit() } catch {}; sendResize(); }, 50);
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => term.write(`\r\n${t.connecting} ${server.ip}:${server.sshPort || '22'}\r\n`);
    ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        if (obj.type === 'output' && typeof obj.data === 'string') term.write(obj.data);
        if (obj.type === 'status') term.write(`\r\n${t.connected}\r\n`);
        if (obj.type === 'error') term.write(`\r\nError: ${obj.message}\r\n`);
      } catch {}
    };
    ws.onclose = () => term.write(`\r\n${t.disconnected || 'Disconnected'}\r\n`);
    term.onData((data) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    });
    const onResize = () => {
      try { fitRef.current?.fit() } catch {}
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const dims = termRef.current;
      const cols = dims?.cols || 120;
      const rows = dims?.rows || 35;
      wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
    };
    window.addEventListener('resize', onResize);
    try { onResize() } catch {}
    return () => {
      window.removeEventListener('resize', onResize);
      try { ws.close() } catch {}
      try { term.dispose() } catch {}
    };
  }, [server.id]);

  useEffect(() => {
    const R: any = (window as any).ResizeObserver;
    if (!R) return;
    const ro = new R(() => { sendResize() });
    if (termContainerRef.current) ro.observe(termContainerRef.current);
    return () => { try { ro.disconnect() } catch {} };
  }, []);

  useEffect(() => {
    if (isMinimized) return;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  useEffect(() => {
    if (!isMinimized) {
      sendResize();
      try { termRef.current?.focus() } catch {}
    }
  }, [isMinimized]);

  useEffect(() => {
    sendResize();
    try { termRef.current?.focus() } catch {}
  }, [isMaximized]);

  const minimizedBadge = (
    <div 
      onClick={onToggleMinimize}
      className="fixed bottom-4 left-4 bg-slate-900 text-white p-3 rounded-full shadow-2xl cursor-pointer hover:bg-slate-800 transition-transform hover:scale-105 z-50 flex items-center gap-2 pr-5 border border-slate-700 animate-in fade-in slide-in-from-bottom-5"
      title={t.restore}
    >
      <div className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse"></div>
      <TerminalIcon className="w-5 h-5" />
      <span className="font-mono text-sm font-semibold">{server.name}</span>
    </div>
  );

  return (
    <>
      <div
        className={`fixed z-50 transition-all duration-300 shadow-2xl overflow-hidden flex flex-col bg-slate-950
          ${isMaximized ? 'inset-0' : 'left-2 right-2 bottom-2 sm:bottom-4 sm:right-4 sm:left-auto w-[95vw] sm:w-[600px] h-[45vh] sm:h-[400px] rounded-xl border border-slate-700'}`}
        style={{ opacity: isMinimized ? 0 : 1, pointerEvents: isMinimized ? 'none' as const : 'auto' as const }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 select-none">
            <div className="flex items-center gap-2 text-slate-200">
                <TerminalIcon className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-mono font-medium">{server.sshUsername || 'root'}@{server.ip}</span>
            </div>
            <div className="flex items-center gap-1">
                 <button onClick={onToggleMinimize} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Minimize">
                    <Minus className="w-4 h-4" />
                 </button>
                 <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title={isMaximized ? "Restore" : "Maximize"}>
                    {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                 </button>
                 <button onClick={onClose} className="p-1.5 hover:bg-rose-900 rounded text-slate-400 hover:text-rose-400" title="Close">
                    <X className="w-4 h-4" />
                 </button>
            </div>
        </div>

        {/* Terminal Body */}
        <div ref={scrollRef} className="flex-1 bg-black p-2 overflow-hidden">
          <div ref={termContainerRef} className="h-full w-full" tabIndex={0} onClick={() => { try { termRef.current?.focus() } catch {} }} />
        </div>
      </div>
    {isMinimized && minimizedBadge}
    </>
  );
};
