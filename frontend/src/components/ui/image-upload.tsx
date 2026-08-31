import { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from './button';

/** Matches MAX_IMAGE_BYTES on the API — a backstop, not the expected size. */
const MAX_BYTES = 1024 * 1024;

/** What we actually aim for; screenshots compress well below this. */
const TARGET_BYTES = 120 * 1024;

/** Displayed at ~600px wide at most, so anything beyond this is wasted bytes. */
const MAX_EDGE = 1000;

const QUALITY_STEPS = [0.8, 0.65, 0.5, 0.4, 0.3];

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** WebP is roughly 25–35% smaller than JPEG at the same quality. */
const supportsWebp = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image'));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

/**
 * Downscales and re-encodes, stepping the quality down until the result fits
 * the target.
 *
 * Images live inline in the Mongo document, so bytes here are bytes on every
 * read of that record. A 4MB screenshot becomes ~5.4MB of base64 untouched;
 * this lands the same image around 60–120KB, which is a ~40× reduction with no
 * visible loss at the size it is displayed.
 */
export const compressImage = async (file: File): Promise<string> => {
  const img = await loadImage(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image');

  // Transparency would render black on an opaque encode.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const mime = supportsWebp() ? 'image/webp' : 'image/jpeg';

  let encoded = canvas.toDataURL(mime, QUALITY_STEPS[0]);
  for (const quality of QUALITY_STEPS.slice(1)) {
    if (encoded.length <= TARGET_BYTES) break;
    encoded = canvas.toDataURL(mime, quality);
  }

  // Still too big at the lowest quality: shrink the pixels instead.
  if (encoded.length > TARGET_BYTES) {
    const shrink = document.createElement('canvas');
    shrink.width = Math.max(1, Math.round(canvas.width * 0.7));
    shrink.height = Math.max(1, Math.round(canvas.height * 0.7));
    const shrinkCtx = shrink.getContext('2d');
    if (shrinkCtx) {
      shrinkCtx.fillStyle = '#ffffff';
      shrinkCtx.fillRect(0, 0, shrink.width, shrink.height);
      shrinkCtx.drawImage(canvas, 0, 0, shrink.width, shrink.height);
      encoded = shrink.toDataURL(mime, 0.5);
    }
  }

  return encoded;
};

export const ImageUpload = ({
  value,
  onChange,
  label = 'Screenshot',
  hint,
  disabled,
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      setError(null);

      if (!ACCEPTED.includes(file.type)) {
        setError('Use a PNG, JPEG, WebP or GIF');
        return;
      }

      setBusy(true);
      try {
        const encoded = await compressImage(file);
        if (encoded.length > MAX_BYTES) {
          setError('Still too large after compression — try a smaller crop');
          return;
        }
        onChange(encoded);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  // Screenshots are usually pasted, not picked from a folder.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || disabled) return;

    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? [])[0];
      if (file) {
        event.preventDefault();
        void accept(file);
      }
    };

    zone.addEventListener('paste', onPaste);
    return () => zone.removeEventListener('paste', onPaste);
  }, [accept, disabled]);

  // base64 is ~4/3 the size of the bytes it encodes.
  const sizeLabel = value ? `${Math.round((value.length / 1024) * 0.75)} KB` : null;

  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="text-sm font-medium leading-none">{label}</span>

      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-border">
          <img src={value} alt={label} className="max-h-56 w-full object-contain bg-muted/40" />
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">{sizeLabel}</span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onChange('')}
                aria-label="Remove image"
              >
                <Icons.trash />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={zoneRef}
          tabIndex={0}
          role="button"
          aria-label={`${label} — click, drop or paste an image`}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void accept(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors',
            'hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dragging && 'border-primary bg-accent/60',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          {busy ? (
            <Icons.spinner className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <Icons.add className="size-5 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {busy ? 'Processing…' : 'Click, drop, or paste a screenshot'}
          </p>
          <p className="text-xs text-muted-foreground">PNG, JPEG, WebP or GIF</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          // Reset so re-picking the same file still fires a change.
          event.target.value = '';
        }}
      />

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
};
