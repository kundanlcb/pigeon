import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement | null>;
  width?: number;
}

export function ContextMenu({ isOpen, onClose, children, triggerRef, width = 192 }: ContextMenuProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let top = rect.bottom + 4;
      let left = rect.right - width;
      
      // Ensure it doesn't go off screen
      if (left < 0) left = rect.left;
      if (top + 200 > window.innerHeight) {
        top = rect.top - 4; // approximate height, will be fixed by CSS bottom translation if needed
      }

      setPosition({ top, left });
    }
  }, [isOpen, triggerRef, width]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && 
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      ref={menuRef}
      style={{ 
        top: position.top, 
        left: position.left, 
        width,
        visibility: position.top === 0 && position.left === 0 ? 'hidden' : 'visible'
      }}
      className="fixed bg-panel-bg border border-border-strong rounded shadow-2xl overflow-hidden z-[9999] py-1"
    >
      {children}
    </div>,
    document.body
  );
}
