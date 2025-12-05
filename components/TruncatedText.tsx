import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Check, ChevronRight } from 'lucide-react';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  maxWidth?: string;
  className?: string;
  showCopy?: boolean;
  label?: string;
  as?: 'span' | 'div' | 'p';
}

/**
 * 截断文本组件 - 超长文本自动截断，点击可查看全文
 */
export const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxLength = 24,
  maxWidth = '12rem',
  className = '',
  showCopy = false,
  label,
  as: Component = 'span'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const displayText = text || '-';
  const isTruncated = displayText.length > maxLength;
  const truncated = isTruncated ? displayText.slice(0, maxLength) + '…' : displayText;
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  
  if (!isTruncated) {
    return (
      <Component 
        className={`${className}`}
        title={displayText}
      >
        {displayText}
      </Component>
    );
  }
  
  return (
    <>
      <Component 
        className={`cursor-pointer hover:text-indigo-600 transition-colors inline-flex items-center gap-1 group ${className}`}
        style={{ maxWidth }}
        onClick={() => setIsOpen(true)}
        title={displayText}
      >
        <span className="truncate">{truncated}</span>
        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-indigo-500" />
      </Component>
      
      {/* 详情弹窗 */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div 
            className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full p-0 animate-in zoom-in-95 fade-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-600">{label || '详细内容'}</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* 内容 */}
            <div className="p-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-sm text-slate-800 break-all leading-relaxed whitespace-pre-wrap">
                  {displayText}
                </p>
              </div>
              
              {showCopy && (
                <button
                  onClick={handleCopy}
                  className={`mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                    copied 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '已复制' : '复制'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * 紧凑型截断文本 - 用于表格和卡片中
 */
export const CompactText: React.FC<{
  text: string;
  maxLength?: number;
  maxWidth?: string;
  className?: string;
}> = ({ text, maxLength, maxWidth = '10rem', className = '' }) => {
  const displayText = text || '-';
  const truncatedText = maxLength && displayText.length > maxLength 
    ? displayText.slice(0, maxLength) + '…' 
    : displayText;
  const needsTruncation = maxLength ? displayText.length > maxLength : false;
  
  const ref = useRef<HTMLSpanElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  
  useEffect(() => {
    if (ref.current) {
      setIsOverflow(ref.current.scrollWidth > ref.current.clientWidth);
    }
  }, [text, truncatedText]);
  
  return (
    <span
      ref={ref}
      className={`block truncate ${className}`}
      style={{ maxWidth }}
      title={(isOverflow || needsTruncation) ? displayText : undefined}
    >
      {truncatedText}
    </span>
  );
};

export default TruncatedText;





