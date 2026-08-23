'use client';

import { Check, Link2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

/**
 * Copies a post's link to the clipboard.
 *
 * Which link depends on the post's status, because the useful one differs: a
 * published post has a public URL, while a draft's public URL 404s and the only
 * link a colleague can actually open is the tokenised preview.
 */
export function postShareLink(
  origin: string,
  post: { status: string; slug: string; categorySlug: string; previewToken: string },
): { url: string; kind: 'public' | 'preview' } {
  return post.status === 'PUBLISHED'
    ? { url: `${origin}/${post.categorySlug}/${post.slug}`, kind: 'public' }
    : { url: `${origin}/preview/${post.slug}?token=${post.previewToken}`, kind: 'preview' };
}

/**
 * `navigator.clipboard` needs a secure context. It is there on localhost and on
 * any HTTPS deploy, but a plain-HTTP staging box would leave the button dead —
 * hence the execCommand fallback rather than a silent failure.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CopyLinkButton({
  post,
  variant = 'icon',
  className,
}: {
  post: { status: string; slug: string; categorySlug: string; previewToken: string; title?: string };
  variant?: 'icon' | 'button';
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    // window.location.origin, not a build-time constant: the copied link should
    // point at whatever host the editor is actually working on.
    const { url, kind } = postShareLink(window.location.origin, post);
    const ok = await copyText(url);

    if (!ok) {
      toast.error('Could not reach the clipboard. Copy it from the address bar instead.');
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    toast.success(
      kind === 'public' ? 'Public link copied.' : 'Preview link copied — works without an account.',
      { description: url },
    );
  };

  const isPreview = post.status !== 'PUBLISHED';
  const label = isPreview ? 'Copy preview link' : 'Copy public link';

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:border-accent hover:text-accent',
          className,
        )}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
        {copied ? 'Copied' : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      title={label}
      aria-label={label}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded border border-border text-muted transition-colors hover:border-accent hover:text-accent',
        copied && 'border-success text-success',
        className,
      )}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
    </button>
  );
}
