'use client';

import { Loader2, Trash2, Upload } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { initials } from '@/lib/byline';

/**
 * Profile picture control, shared by the reader account page and the staff
 * profile screen — because a picture is the one thing every account type can
 * change, and having two copies of this would mean two sets of upload bugs.
 *
 * It saves immediately rather than waiting for a form submit. An avatar has no
 * draft state worth preserving, and a reader who picks a file, sees it appear
 * and closes the tab should not lose it.
 */
export function AvatarPicker({
  name,
  image,
  onChange,
  size = 'lg',
}: {
  name: string;
  image: string | null;
  onChange?: (url: string | null) => void;
  size?: 'md' | 'lg';
}) {
  const [current, setCurrent] = React.useState(image);
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  // Adjusted during render rather than in an effect: when the server sends a
  // new value down after a refresh, the preview should already be correct on
  // the first paint instead of flashing the old picture and then correcting
  // itself. Guarded on `busy` so a refresh mid-upload cannot revert what the
  // user just chose.
  const [lastProp, setLastProp] = React.useState(image);
  if (image !== lastProp && !busy) {
    setLastProp(image);
    setCurrent(image);
  }

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/account/avatar', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed.');
      setCurrent(json.url as string);
      onChange?.(json.url as string);
      toast.success('Profile picture updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove the picture.');
      setCurrent(null);
      onChange?.(null);
      toast.success('Profile picture removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const box = size === 'lg' ? 'size-20 text-xl' : 'size-14 text-base';

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span
        className={`grid ${box} shrink-0 place-items-center overflow-hidden rounded-full bg-elevated font-bold text-accent`}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="" className="size-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>

      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          aria-label="Profile picture"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Upload className="mr-1.5 size-4" />
          )}
          {current ? 'Replace picture' : 'Upload picture'}
        </Button>
        {current ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
            <Trash2 className="mr-1.5 size-4" />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
