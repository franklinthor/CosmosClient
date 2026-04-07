import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';

interface UseHorizontalResizeOptions {
  containerRef: RefObject<HTMLElement | null>;
  storageKey: string;
  defaultSize: number;
  minSize: number;
  getMaxSize: (containerWidth: number) => number;
  enabled?: boolean;
  step?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const readStoredSize = (storageKey: string, defaultSize: number) => {
  if (typeof window === 'undefined') {
    return defaultSize;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultSize;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultSize;
};

export function useHorizontalResize({
  containerRef,
  storageKey,
  defaultSize,
  minSize,
  getMaxSize,
  enabled = true,
  step = 24,
}: UseHorizontalResizeOptions) {
  const [size, setSize] = useState(() => readStoredSize(storageKey, defaultSize));
  const [isResizing, setIsResizing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const clampSize = useCallback(
    (nextSize: number) => {
      const maxSize = containerWidth
        ? Math.max(minSize, getMaxSize(containerWidth))
        : Number.POSITIVE_INFINITY;

      return Math.round(clamp(nextSize, minSize, maxSize));
    },
    [containerWidth, getMaxSize, minSize]
  );

  const resolvedSize = clampSize(size);

  const resetSize = useCallback(() => {
    setSize(clampSize(defaultSize));
  }, [clampSize, defaultSize]);

  const startResizing = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }

      event.preventDefault();
      setIsResizing(true);
    },
    [enabled]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          setSize(prev => clampSize(prev - step));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setSize(prev => clampSize(prev + step));
          break;
        case 'Home':
          event.preventDefault();
          setSize(clampSize(minSize));
          break;
        case 'End':
          event.preventDefault();
          setSize(prev => clampSize(prev + Number.POSITIVE_INFINITY));
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          resetSize();
          break;
        default:
          break;
      }
    },
    [clampSize, enabled, minSize, resetSize, step]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(storageKey, String(size));
  }, [size, storageKey]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? node.getBoundingClientRect().width;
      setContainerWidth(prev => (prev === nextWidth ? prev : nextWidth));
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [containerRef]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (event: MouseEvent) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      setSize(clampSize(event.clientX - bounds.left));
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [clampSize, containerRef, isResizing]);

  return {
    size: resolvedSize,
    isResizing,
    startResizing,
    handleKeyDown,
    resetSize,
  };
}
