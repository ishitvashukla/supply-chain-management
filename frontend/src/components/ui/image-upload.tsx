import { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from './button';

/** Matches MAX_IMAGE_BYTES on the API. */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 1400;
const QUALITY = 0.82;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Downscales and re-encodes before upload.
 *
 * Images are stored inline in Mongo, so a raw 4MB screenshot would become ~5MB
 * of base64 on the document. Re-encoding a screenshot to a 1400px JPEG usually
 * lands under 300KB with no visible loss at the sizes we display.
 */
const compress = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process the image'));

        // GIF/PNG transparency would go black on a JPEG canvas.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

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
        const encoded = await compress(file);
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
