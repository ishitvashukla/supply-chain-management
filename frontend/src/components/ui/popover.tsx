import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Anchored popover used by the select and date components.
 *
 * On phones it renders as a bottom sheet instead of a floating panel: a
 * panel anchored to a trigger near the bottom of a small screen ends up
 * clipped or under the keyboard, which is exactly where these controls live.
 */
export const Popover = ({
  open,
  onClose,
  anchorRef,
  children,
  className,
  align = 'start',
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Position before paint so the panel never flashes in the wrong place.
  useLayoutEffect(() => {
    if (!open || isMobile) return;

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 280;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Flip above the trigger when there isn't room beneath it.
      const top =
        spaceBelow < panelHeight + 12 && rect.top > panelHeight + 12
          ? rect.top - panelHeight - 6
          : rect.bottom + 6;

      const width = Math.max(rect.width, 220);
      const left =
        align === 'end'
          ? Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
          : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

      setStyle({ top, left, width });
    };

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, isMobile, anchorRef, align]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKey);
    // `pointerdown` closes before a click lands on whatever is underneath.
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-end">
        <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
        <div
          ref={panelRef}
          className={cn(
            'relative max-h-[75dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-popover p-2 shadow-xl animate-fade-in-up',
            className,
          )}
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      style={style ? { top: style.top, left: style.left, minWidth: style.width } : undefined}
      className={cn(
        'fixed z-[60] max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg animate-fade-in',
        !style && 'invisible',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
};
