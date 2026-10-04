import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface JsonPathExtractorProps {
  data: any;
  onExtract: (path: string, value: any) => void;
  rootName?: string;
}

function getPathString(path: (string | number)[]): string {
  if (path.length === 0) return '';
  return path.map(p => typeof p === 'number' ? `[${p}]` : `.${p}`).join('').replace(/^\./, '');
}

interface JsonNodeProps {
  keyName: string | number;
  value: any;
  path: (string | number)[];
  onExtract: (path: string, value: any) => void;
  isRoot?: boolean;
}

function JsonNode({ keyName, value, path, onExtract, isRoot = false }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const handleExtract = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExtract(getPathString(path), value);
  };

  if (!isObject) {
    return (
      <div 
        className="flex items-center space-x-1 hover:bg-accent/10 px-1 py-0.5 rounded cursor-pointer group relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleExtract}
        title="Click to extract as variable"
      >
        <span className="text-[#9cdcfe]">{keyName}:</span>
        <span className={typeof value === 'string' ? 'text-[#ce9178]' : typeof value === 'number' ? 'text-[#b5cea8]' : 'text-[#569cd6]'}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
        {isHovered && (
          <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 text-[10px] bg-accent text-white px-1.5 py-0.5 rounded">
            <span>Extract</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col ml-3 first:ml-0 font-mono text-[12px] leading-tight">
      <div 
        className="flex items-center space-x-1 cursor-pointer hover:bg-surface-hover px-1 py-0.5 rounded group"
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isExpanded ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted shrink-0" />}
        {!isRoot && <span className="text-[#9cdcfe]">{keyName}:</span>}
        <span className="text-text-muted">{isArray ? '[' : '{'}</span>
        {!isExpanded && <span className="text-text-muted">...{isArray ? ']' : '}'}</span>}
        
        {isHovered && !isRoot && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onExtract(getPathString(path), value);
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 text-[10px] bg-accent/20 text-accent hover:bg-accent hover:text-white px-1.5 py-0.5 rounded z-10"
          >
            <span>Extract {isArray ? 'Array' : 'Object'}</span>
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="border-l border-border-subtle ml-[7px] pl-2 flex flex-col space-y-0.5 mt-0.5">
          {Object.entries(value).map(([k, v]) => (
            <JsonNode 
              key={k} 
              keyName={isArray ? parseInt(k, 10) : k} 
              value={v} 
              path={[...path, isArray ? parseInt(k, 10) : k]} 
              onExtract={onExtract}
            />
          ))}
        </div>
      )}
      
      {isExpanded && (
        <div className="pl-1">
          <span className="text-text-muted">{isArray ? ']' : '}'}</span>
        </div>
      )}
    </div>
  );
}

export function JsonPathExtractor({ data, onExtract, rootName = 'response' }: JsonPathExtractorProps) {
  if (data === undefined || data === null) {
    return <div className="text-text-muted italic p-4 text-center">No data available to extract</div>;
  }

  // Parse string if it's JSON
  let parsedData = data;
  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
    } catch {
      // If not JSON string, just show it as a single node
      return (
        <div className="p-2 overflow-auto bg-surface-bg rounded">
          <JsonNode keyName={rootName} value={data} path={[]} onExtract={onExtract} isRoot={true} />
        </div>
      );
    }
  }

  return (
    <div className="p-2 overflow-auto max-h-full bg-surface-bg rounded custom-scrollbar">
      <JsonNode keyName={rootName} value={parsedData} path={[]} onExtract={onExtract} isRoot={true} />
    </div>
  );
}
