import type { KeyboardEventHandler, MouseEventHandler } from 'react';
import { cn } from '../../lib/utils';

interface ResizeHandleProps {
  ariaLabel: string;
  isActive?: boolean;
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onDoubleClick?: () => void;
  className?: string;
}

export function ResizeHandle({
  ariaLabel,
  isActive = false,
  onMouseDown,
  onKeyDown,
  onDoubleClick,
  className,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group relative w-3 shrink-0 cursor-col-resize touch-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
        className
      )}
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/80 transition-colors group-hover:bg-primary/50 group-focus-visible:bg-primary/70" />
      <div
        className={cn(
          'absolute inset-y-[22%] left-1/2 w-1 -translate-x-1/2 rounded-full bg-primary/0 transition-colors',
          isActive && 'bg-primary/25'
        )}
      />
    </div>
  );
}
