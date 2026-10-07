import React from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, Circle, MoreHorizontal } from 'lucide-react';

export function getMethodColor(method: string) {
  switch (method) {
    case 'GET': return 'text-blue-400';
    case 'POST': return 'text-green-400';
    case 'PUT': return 'text-yellow-400';
    case 'DELETE': return 'text-red-400';
    default: return 'text-purple-400';
  }
}

interface SidebarRequestProps {
  request: any;
  depth: number;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
}

export function SidebarRequest({ request, depth, isSelected, onToggleSelection }: SidebarRequestProps) {
  return (
    <div 
      onClick={() => onToggleSelection(request.id)}
      style={{ paddingLeft: `${(depth + 1) * 16}px` }}
      className={`w-full flex items-center h-[24px] pr-2 cursor-pointer group transition-colors select-none ${
        isSelected ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-surface-hover text-text-secondary hover:text-text-primary'
      }`}
    >
      <div className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0 text-accent">
        {isSelected ? <CheckCircle2 size={13} /> : <Circle size={13} className="text-text-muted opacity-50 group-hover:opacity-100 transition-opacity" />}
      </div>
      <span className={`text-[10px] font-bold w-10 shrink-0 ${getMethodColor(request.method)}`}>
        {request.method}
      </span>
      <span className="text-[12.5px] leading-[24px] tracking-[-0.01em] truncate flex-1">
        {request.name}
      </span>
    </div>
  );
}

interface SidebarFolderProps {
  folder: any;
  depth: number;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onMenuClick?: (e: React.MouseEvent, folderId: string) => void;
  isMenuOpen?: boolean;
  menuContent?: React.ReactNode;
}

export function SidebarFolder({ folder, depth, isCollapsed, onToggleCollapse, onMenuClick, isMenuOpen, menuContent }: SidebarFolderProps) {
  return (
    <div 
      className="w-full flex items-center h-[24px] pr-2 cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors group relative select-none"
      style={{ paddingLeft: `${(depth + 1) * 16}px` }}
    >
      <div className="flex flex-1 items-center overflow-hidden h-full" onClick={() => onToggleCollapse(folder.id)}>
        <span className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0 text-text-muted group-hover:text-text-primary">
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </span>
        <span className="text-[12.5px] tracking-[-0.01em] truncate flex-1 font-medium">{folder.name}</span>
      </div>
      {onMenuClick && (
        <button
          className={`w-5 h-5 flex items-center justify-center transition-opacity text-text-muted hover:text-text-primary hover:bg-border-subtle rounded flex-shrink-0 ${isMenuOpen ? 'opacity-100 bg-border-subtle text-text-primary' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => onMenuClick(e, folder.id)}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
      {menuContent}
    </div>
  );
}

interface SidebarCollectionProps {
  collection: any;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onMenuClick?: (e: React.MouseEvent, colId: string) => void;
  isMenuOpen?: boolean;
  menuContent?: React.ReactNode;
}

export function SidebarCollection({ collection, isExpanded, onToggleExpand, onMenuClick, isMenuOpen, menuContent }: SidebarCollectionProps) {
  return (
    <div className="w-full flex items-center h-[24px] px-2 cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors group relative select-none">
      <div className="flex flex-1 items-center overflow-hidden h-full" onClick={() => onToggleExpand(collection.id)}>
        <span className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0 text-text-muted group-hover:text-text-primary">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="text-[12.5px] font-semibold tracking-[-0.01em] truncate flex-1">{collection.name}</span>
      </div>
      {onMenuClick && (
        <button
          className={`w-5 h-5 flex items-center justify-center transition-opacity text-text-muted hover:text-text-primary hover:bg-border-subtle rounded flex-shrink-0 ${isMenuOpen ? 'opacity-100 bg-border-subtle text-text-primary' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => onMenuClick(e, collection.id)}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
      {menuContent}
    </div>
  );
}
