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
      className={`flex items-center px-1 py-1 rounded-md text-[12px] cursor-pointer group transition-colors ${
        isSelected ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-surface-hover text-text-secondary hover:text-text-primary'
      }`}
    >
      <div className="w-4 h-4 flex items-center justify-center mr-2 flex-shrink-0 text-accent">
        {isSelected ? <CheckCircle2 size={13} /> : <Circle size={13} className="text-text-muted opacity-50 group-hover:opacity-100 transition-opacity" />}
      </div>
      <span className={`text-[9px] font-bold w-10 shrink-0 ${getMethodColor(request.method)}`}>
        {request.method}
      </span>
      <span className="truncate flex-1">
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
      className="flex items-center px-1 py-1 rounded-md text-[12px] hover:bg-surface-hover cursor-pointer group text-text-secondary hover:text-text-primary relative"
      style={{ paddingLeft: `${(depth + 1) * 16}px` }}
    >
      <div className="flex flex-1 items-center overflow-hidden" onClick={() => onToggleCollapse(folder.id)}>
        <span className="w-4 h-4 flex items-center justify-center mr-1 flex-shrink-0 text-text-muted group-hover:text-text-primary">
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </span>
        <span className="truncate flex-1 font-medium">{folder.name}</span>
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
    <div className="flex items-center space-x-1.5 px-1 py-1.5 rounded-md text-[13px] hover:bg-surface-hover group relative">
      <div 
        onClick={() => onToggleExpand(collection.id)}
        className="w-4 h-4 flex items-center justify-center cursor-pointer text-text-muted hover:text-text-primary shrink-0"
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
      <div className="flex-1 flex items-center overflow-hidden cursor-pointer" onClick={() => onToggleExpand(collection.id)}>
        <span className="truncate text-text-primary font-medium">{collection.name}</span>
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
