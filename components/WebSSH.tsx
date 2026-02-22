import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Minus, X, Maximize2, Minimize2, RefreshCw, Wifi, WifiOff, Loader, Info } from 'lucide-react';
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

type ConnState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface CtxMenu { x: number; y: number }

const THEMES = {
  dark:      { background: '#1a1b26', foreground: '#a9b1d6', cursor: '#c0caf5', selectionBackground: '#283457' },
  matrix:    { background: '#000000', foreground: '#10b981', cursor: '#10b981', selectionBackground: '#064e3b' },
  solarized: { background: '#002b36', foreground: '#839496', cursor: '#93a1a1', selectionBackground: '#073642' },
  light:     { background: '#fafafa', foreground: '#383a42', cursor: '#526fff', selectionBackground: '#d6d6d6' },
} as const;
type ThemeKey = keyof typeof THEMES;

const ERROR_MSGS: Record<string, string> = {
  no_auth:       '未配置 SSH Key 或密码，请在服务器设置中填写',
  auth_error:    '认证失败，请检查 SSH Key 或密码',
  refused:       '连接被拒绝，请确认 IP 和端口是否正确',
  timeout:       '连接超时，服务器可能不可达',
  shell_error:   '打开 Shell 失败',
  connect_error: '连接失败',
  internal_error:'服务器内部错误',
};

export const WebSSH: React.FC<WebSSHProps> = ({ server, onClose, isMinimized, onToggleMinimize, lang }) => {
  const [isMaximized, setIsMaximized]   = useState(false);
  const [connState, setConnState]        = useState<ConnState>('connecting');
  const [errMsg, setErrMsg]              = useState('');
  const [ctxMenu, setCtxMenu]            = useState<CtxMenu | null>(null);
  const [theme, setTheme]                = useState<ThemeKey>('dark');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [retryCount, setRetryCount]      = useState(0);

  const termContainerRef = useRef<HTMLDivElement>(null);
  const wsRef   = useRef<WebSocket | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef  = useRef<FitAddon | null>(null);
  const disposed = useRef(false);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = translations[lang];

  // ── helpers ──────────────────────────────────────────────────────────────
  const safeFit = useCallback(() => {
    const c = termContainerRef.current;
    if (disposed.current || !fitRef.current || !c || c.offsetWidth < 10) return;
    try { fitRef.current.fit(); } catch {}
  }, []);

  const sendSize = useCallback(() => {
    safeFit();
    const ws = wsRef.current;
    const tm = termRef.current;
    if (ws?.readyState === WebSocket.OPEN && tm) {
      try { ws.send(JSON.stringify({ type: 'resize', cols: tm.cols, rows: tm.rows })); } catch {}
    }
  }, [safeFit]);

  const writeToTerm = (text: string) => {
    try { termRef.current?.write(text); } catch {}
  };

  // ── clipboard paste ───────────────────────────────────────────────────────
  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
        termRef.current?.focus();
      }
    } catch {
      // 权限被拒：fallback 提示
      writeToTerm('\r\n\x1b[33m[粘贴失败：请允许浏览器访问剪贴板，或使用 Shift+Insert]\x1b[0m\r\n');
    }
  }, []);

  // ── init / reconnect ──────────────────────────────────────────────────────
  const connect = useCallback(() => {
    disposed.current = false;
    setConnState('connecting');
    setErrMsg('');

    const container = termContainerRef.current;
    if (!container) return;

    const doInit = () => {
      if (disposed.current) return;
      if (container.offsetWidth < 10) { setTimeout(doInit, 50); return; }

      // 销毁旧实例
      try { wsRef.current?.close(); } catch {}
      try { termRef.current?.dispose(); } catch {}
      if (pingTimer.current) clearInterval(pingTimer.current);
      container.innerHTML = '';

      // 新建终端
      const term = new XTerm({
        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        theme: THEMES[theme],
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 2000,
        allowProposedApi: true,
        // 让 xterm 处理大多数默认快捷键，我们只拦截 Ctrl+V
        macOptionIsMeta: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      termRef.current = term;
      fitRef.current  = fit;

      term.open(container);
      setTimeout(() => { try { fit.fit(); term.focus(); } catch {} }, 80);

      // ── Ctrl+V / Cmd+V 粘贴 ──────────────────────────────────
      term.attachCustomKeyEventHandler((ev: KeyboardEvent) => {
        // Ctrl+V (Windows/Linux) 或 Cmd+V (Mac)
        if (ev.type === 'keydown' && ev.key === 'v' && (ev.ctrlKey || ev.metaKey) && !ev.altKey) {
          pasteFromClipboard();
          return false; // 阻止 xterm 默认行为
        }
        // Ctrl+Shift+C 复制选中文本
        if (ev.type === 'keydown' && ev.key === 'C' && ev.ctrlKey && ev.shiftKey) {
          const sel = term.getSelection();
          if (sel) navigator.clipboard.writeText(sel).catch(() => {});
          return false;
        }
        return true;
      });

      // 用户输入 → WebSocket
      term.onData((data) => {
        if (disposed.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try { wsRef.current.send(JSON.stringify({ type: 'input', data })); } catch {}
        }
      });

      // ── WebSocket ──────────────────────────────────────────────
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1') as string;
      const token = localStorage.getItem('serdo_auth_token') || '';
      const wsUrl = base.replace(/^http/, 'ws') + `/ssh?token=${encodeURIComponent(token)}&serverId=${encodeURIComponent(server.id)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed.current) return;
        // keep-alive ping 每 20s
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
          }
        }, 20000);
      };

      ws.onmessage = (ev) => {
        if (disposed.current) return;
        try {
          const obj = JSON.parse(ev.data);
          if (obj.type === 'output') {
            term.write(obj.data);
          } else if (obj.type === 'status' && obj.data === 'ready') {
            setConnState('connected');
            term.write(`\x1b[32m✓ 已连接 ${server.sshUsername || 'root'}@${server.ip}:${server.sshPort || 22}\x1b[0m\r\n`);
          } else if (obj.type === 'status' && obj.data === 'connecting') {
            term.write(`\x1b[90m正在连接 ${server.ip}:${server.sshPort || 22}...\x1b[0m\r\n`);
          } else if (obj.type === 'error') {
            const msg = ERROR_MSGS[obj.message] || obj.detail || obj.message || '连接失败';
            setConnState('error');
            setErrMsg(msg);
            term.write(`\r\n\x1b[31m✗ ${msg}\x1b[0m\r\n`);
          } else if (obj.type === 'pong') {
            // keep-alive 回应，忽略
          }
        } catch {}
      };

      ws.onclose = () => {
        if (disposed.current) return;
        if (pingTimer.current) clearInterval(pingTimer.current);
        setConnState(prev => prev === 'error' ? 'error' : 'disconnected');
        term.write('\r\n\x1b[33m[连接已断开]\x1b[0m\r\n');
      };

      ws.onerror = () => {
        if (disposed.current) return;
        setConnState('error');
        setErrMsg('WebSocket 连接失败');
      };
    };

    requestAnimationFrame(doInit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id, theme, retryCount, pasteFromClipboard]);

  // 初始化 + 重连
  useEffect(() => {
    connect();
    return () => {
      disposed.current = true;
      if (pingTimer.current) clearInterval(pingTimer.current);
      try { wsRef.current?.close(); } catch {}
      try { termRef.current?.dispose(); } catch {}
      termRef.current = null;
      fitRef.current  = null;
      wsRef.current   = null;
    };
  }, [connect]);

  // window resize
  useEffect(() => {
    const onResize = () => requestAnimationFrame(sendSize);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sendSize]);

  // ResizeObserver
  useEffect(() => {
    const R = (window as any).ResizeObserver;
    if (!R || !termContainerRef.current) return;
    const ro = new R(() => requestAnimationFrame(sendSize));
    ro.observe(termContainerRef.current);
    return () => { try { ro.disconnect(); } catch {} };
  }, [sendSize]);

  // 从最小化恢复
  useEffect(() => {
    if (!isMinimized) setTimeout(() => { sendSize(); try { termRef.current?.focus(); } catch {} }, 120);
  }, [isMinimized, sendSize]);

  // 最大化切换
  useEffect(() => {
    setTimeout(() => { sendSize(); try { termRef.current?.focus(); } catch {} }, 120);
  }, [isMaximized, sendSize]);

  // 主题切换（不重连，直接更新 options）
  useEffect(() => {
    if (termRef.current) {
      try { termRef.current.options = { theme: THEMES[theme] }; } catch {}
    }
  }, [theme]);

  // 关闭右键菜单
  useEffect(() => {
    if (!ctxMenu) return;
    const hide = () => setCtxMenu(null);
    window.addEventListener('click', hide, { once: true });
    return () => window.removeEventListener('click', hide);
  }, [ctxMenu]);

  // ── 右键菜单 ─────────────────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCopySelection = () => {
    const sel = termRef.current?.getSelection();
    if (sel) navigator.clipboard.writeText(sel).catch(() => {});
    setCtxMenu(null);
  };

  const handleClearScreen = () => {
    termRef.current?.clear();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: '\x0c' })); // Ctrl+L
    }
    setCtxMenu(null);
  };

  // ── 状态颜色/图标 ─────────────────────────────────────────────────────────
  const stateColor = {
    connecting:   'text-yellow-400',
    connected:    'text-emerald-400',
    disconnected: 'text-slate-400',
    error:        'text-rose-400',
  }[connState];

  const StateIcon = {
    connecting:   Loader,
    connected:    Wifi,
    disconnected: WifiOff,
    error:        WifiOff,
  }[connState];

  const stateLabel = {
    connecting:   '连接中...',
    connected:    '已连接',
    disconnected: '已断开',
    error:        '连接失败',
  }[connState];

  const canReconnect = connState === 'disconnected' || connState === 'error';

  // ── 快捷键提示 ────────────────────────────────────────────────────────────
  const shortcuts = [
    { key: 'Ctrl+V / Cmd+V', desc: '粘贴' },
    { key: 'Ctrl+Shift+C',   desc: '复制选中' },
    { key: 'Ctrl+C',         desc: '中断进程' },
    { key: 'Ctrl+D',         desc: '退出/登出' },
    { key: 'Ctrl+L',         desc: '清屏' },
    { key: 'Ctrl+Z',         desc: '挂起进程' },
    { key: 'Tab',            desc: '自动补全' },
    { key: '↑ / ↓',          desc: '历史命令' },
  ];

  // ── minimized badge ───────────────────────────────────────────────────────
  const minimizedBadge = (
    <div
      onClick={onToggleMinimize}
      className="fixed bottom-4 left-4 bg-slate-900 text-white p-3 rounded-full shadow-2xl cursor-pointer hover:bg-slate-800 z-50 flex items-center gap-2 pr-5 border border-slate-700"
    >
      <div className={`w-2 h-2 rounded-full ${connState === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
      <TerminalIcon className="w-5 h-5" />
      <span className="font-mono text-sm font-semibold">{server.name}</span>
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`fixed z-50 shadow-2xl flex flex-col bg-slate-950 transition-all duration-200
          ${isMaximized
            ? 'inset-0'
            : 'left-2 right-2 bottom-2 sm:bottom-4 sm:right-4 sm:left-auto w-[95vw] sm:w-[680px] h-[50vh] sm:h-[460px] rounded-xl border border-slate-700'}`}
        style={{ opacity: isMinimized ? 0 : 1, pointerEvents: isMinimized ? 'none' : 'auto' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <TerminalIcon className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-mono font-medium text-slate-200 truncate">
              {server.sshUsername || 'root'}@{server.ip}:{server.sshPort || 22}
            </span>
            {/* 连接状态 */}
            <div className={`flex items-center gap-1 shrink-0 ${stateColor}`}>
              <StateIcon className={`w-3.5 h-3.5 ${connState === 'connecting' ? 'animate-spin' : ''}`} />
              <span className="text-xs hidden sm:inline">{stateLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* 主题切换 */}
            <select
              value={theme}
              onChange={e => setTheme(e.target.value as ThemeKey)}
              className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded px-1 py-0.5 mr-1 hidden sm:block"
              title="终端主题"
            >
              <option value="dark">Dark</option>
              <option value="matrix">Matrix</option>
              <option value="solarized">Solarized</option>
              <option value="light">Light</option>
            </select>
            {/* 快捷键提示 */}
            <button
              onClick={() => setShowShortcuts(v => !v)}
              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              title="快捷键"
            >
              <Info className="w-4 h-4" />
            </button>
            {/* 重连 */}
            {canReconnect && (
              <button
                onClick={() => setRetryCount(n => n + 1)}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400"
                title="重新连接"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onToggleMinimize} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="最小化">
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={() => setIsMaximized(v => !v)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title={isMaximized ? '还原' : '最大化'}>
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-rose-900 rounded text-slate-400 hover:text-rose-400" title="关闭">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 错误提示条 ── */}
        {connState === 'error' && errMsg && (
          <div className="bg-rose-950 border-b border-rose-800 px-3 py-1.5 text-xs text-rose-300 flex items-center justify-between shrink-0">
            <span>✗ {errMsg}</span>
            <button
              onClick={() => setRetryCount(n => n + 1)}
              className="ml-3 text-rose-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> 重试
            </button>
          </div>
        )}

        {/* ── 快捷键面板 ── */}
        {showShortcuts && (
          <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
              {shortcuts.map(s => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <kbd className="text-[10px] bg-slate-700 text-slate-300 px-1 py-0.5 rounded font-mono whitespace-nowrap">{s.key}</kbd>
                  <span className="text-[11px] text-slate-400">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 终端区 ── */}
        <div
          className="flex-1 bg-black overflow-hidden px-1 pt-1"
          onContextMenu={handleContextMenu}
        >
          <div
            ref={termContainerRef}
            className="h-full w-full"
            tabIndex={0}
            onClick={() => { try { termRef.current?.focus(); } catch {} }}
          />
        </div>

        {/* ── 底部快捷按钮（移动端友好） ── */}
        <div className="bg-slate-900 border-t border-slate-800 px-2 py-1 flex gap-1 sm:hidden shrink-0">
          {[
            { label: 'Paste', action: pasteFromClipboard },
            { label: 'Ctrl+C', action: () => wsRef.current?.send(JSON.stringify({ type: 'input', data: '\x03' })) },
            { label: 'Ctrl+D', action: () => wsRef.current?.send(JSON.stringify({ type: 'input', data: '\x04' })) },
            { label: 'Tab',    action: () => wsRef.current?.send(JSON.stringify({ type: 'input', data: '\t' })) },
            { label: '↑',      action: () => wsRef.current?.send(JSON.stringify({ type: 'input', data: '\x1b[A' })) },
            { label: '↓',      action: () => wsRef.current?.send(JSON.stringify({ type: 'input', data: '\x1b[B' })) },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 font-mono"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 右键菜单 ── */}
      {ctxMenu && (
        <div
          className="fixed z-[60] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[140px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button
            onClick={() => { pasteFromClipboard(); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
          >
            📋 粘贴
          </button>
          <button
            onClick={handleCopySelection}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
          >
            📄 复制选中
          </button>
          <div className="border-t border-slate-700 my-1" />
          <button
            onClick={handleClearScreen}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
          >
            🧹 清屏
          </button>
          {canReconnect && (
            <button
              onClick={() => { setRetryCount(n => n + 1); setCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
            >
              🔄 重新连接
            </button>
          )}
        </div>
      )}

      {isMinimized && minimizedBadge}
    </>
  );
};
