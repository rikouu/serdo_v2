
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
  const [isReady, setIsReady] = useState(false); // 终端是否已初始化
  const termContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const isDisposedRef = useRef(false);
  const t = translations[lang];

  // 安全地调用 fit()
  const safeFit = () => {
    if (isDisposedRef.current || !isReady) return;
    if (!fitRef.current || !termRef.current) return;
    const container = termContainerRef.current;
    if (!container || container.offsetWidth < 10 || container.offsetHeight < 10) return;
    
    try {
      fitRef.current.fit();
    } catch {
      // 静默忽略
    }
  };

  const sendResize = () => {
    if (isDisposedRef.current || !isReady) return;
    safeFit();
    if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ 
          type: 'resize', 
          cols: termRef.current.cols || 120, 
          rows: termRef.current.rows || 35 
        }));
      } catch {}
    }
  };

  // 主初始化 effect
  useEffect(() => {
    isDisposedRef.current = false;
    setIsReady(false);
    
    const container = termContainerRef.current;
    if (!container) return;

    // 等待容器有足够尺寸后再初始化终端
    const initTerminal = () => {
      if (isDisposedRef.current) return;
      if (container.offsetWidth < 10 || container.offsetHeight < 10) {
        // 容器尺寸不足，延迟重试
        setTimeout(initTerminal, 50);
        return;
      }

      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1') as string;
      const token = localStorage.getItem('serdo_auth_token') || '';
      const url = base.replace(/^http/, 'ws') + `/ssh?token=${encodeURIComponent(token)}&serverId=${encodeURIComponent(server.id)}`;

      // 创建终端
      const term = new XTerm({
        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 13,
        theme: { background: '#000000', foreground: '#10b981' },
        cursorBlink: true,
        cursorStyle: 'block',
        cols: 120,
        rows: 35,
        allowProposedApi: true, // 允许实验性 API
      });
      
      const fit = new FitAddon();
      term.loadAddon(fit);
      termRef.current = term;
      fitRef.current = fit;

      // 打开终端
      try {
        term.open(container);
      } catch (e) {
        console.error('[WebSSH] Failed to open terminal:', e);
        return;
      }

      // 标记为已就绪
      setIsReady(true);

      // 延迟 fit 和 focus
      setTimeout(() => {
        if (isDisposedRef.current) return;
        try {
          fit.fit();
          term.focus();
        } catch {}
      }, 100);

      // 建立 WebSocket 连接
      const ws = new WebSocket(url);
      wsRef.current = ws;
      
      ws.onopen = () => {
        if (isDisposedRef.current) return;
        try { term.write(`\r\n${t.connecting} ${server.ip}:${server.sshPort || '22'}\r\n`); } catch {}
      };
      
      ws.onmessage = (ev) => {
        if (isDisposedRef.current) return;
        try {
          const obj = JSON.parse(ev.data);
          if (obj.type === 'output' && typeof obj.data === 'string') term.write(obj.data);
          else if (obj.type === 'status') term.write(`\r\n${t.connected}\r\n`);
          else if (obj.type === 'error') term.write(`\r\nError: ${obj.message}\r\n`);
        } catch {}
      };
      
      ws.onclose = () => {
        if (isDisposedRef.current) return;
        try { term.write(`\r\n${t.disconnected || 'Disconnected'}\r\n`); } catch {}
      };
      
      term.onData((data) => {
        if (isDisposedRef.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try { wsRef.current.send(JSON.stringify({ type: 'input', data })); } catch {}
        }
      });
    };

    // 使用 requestAnimationFrame 确保 DOM 已渲染
    requestAnimationFrame(() => {
      if (!isDisposedRef.current) initTerminal();
    });

    // 窗口 resize 处理
    const onResize = () => {
      if (!isDisposedRef.current && isReady) sendResize();
    };
    window.addEventListener('resize', onResize);

    return () => {
      isDisposedRef.current = true;
      setIsReady(false);
      window.removeEventListener('resize', onResize);
      try { wsRef.current?.close(); } catch {}
      try { termRef.current?.dispose(); } catch {}
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [server.id]);

  // ResizeObserver
  useEffect(() => {
    const R = (window as any).ResizeObserver;
    if (!R || !termContainerRef.current) return;
    
    const ro = new R(() => {
      if (!isDisposedRef.current && isReady) {
        // 使用 requestAnimationFrame 避免同步调用
        requestAnimationFrame(sendResize);
      }
    });
    ro.observe(termContainerRef.current);
    return () => { try { ro.disconnect(); } catch {} };
  }, [isReady]);

  // 从最小化恢复
  useEffect(() => {
    if (!isMinimized && isReady && !isDisposedRef.current) {
      setTimeout(() => {
        if (!isDisposedRef.current) {
          sendResize();
          try { termRef.current?.focus(); } catch {}
        }
      }, 100);
    }
  }, [isMinimized, isReady]);

  // 最大化切换
  useEffect(() => {
    if (isReady && !isDisposedRef.current) {
      setTimeout(() => {
        if (!isDisposedRef.current) {
          sendResize();
          try { termRef.current?.focus(); } catch {}
        }
      }, 100);
    }
  }, [isMaximized, isReady]);

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
        <div className="flex-1 bg-black p-2 overflow-hidden">
          <div ref={termContainerRef} className="h-full w-full" tabIndex={0} onClick={() => { try { termRef.current?.focus() } catch {} }} />
        </div>
      </div>
    {isMinimized && minimizedBadge}
    </>
  );
};
