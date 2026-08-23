/**
 * TipTap document helpers shared by the editor, the seed and the renderer.
 * The canonical body format is TipTap/ProseMirror JSON; `bodyText` on Post is
 * a flattened copy kept in sync on every save so Postgres can index it.
 */

export type TipTapMark = { type: string; attrs?: Record<string, unknown> };

export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
};

export type TipTapDoc = { type: 'doc'; content: TipTapNode[] };

export const emptyDoc = (): TipTapDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

/** Depth-first text extraction. Feeds full-text search and reading time. */
export function docToText(doc: unknown): string {
  const out: string[] = [];
  const walk = (node: TipTapNode | undefined) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.text === 'string') out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
    if (node.type === 'paragraph' || node.type === 'heading') out.push('\n');
  };
  walk(doc as TipTapNode);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** 225 wpm, the usual editorial estimate, floored at one minute. */
export function readingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

export function autoExcerpt(text: string, max = 180): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return `${cut.slice(0, lastStop > 60 ? lastStop : max).trim()}…`;
}

// ------------------------------------------------------------ node builders

export const p = (text: string): TipTapNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

export const h = (level: 2 | 3, text: string): TipTapNode => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});

export const quote = (text: string): TipTapNode => ({
  type: 'blockquote',
  content: [p(text)],
});

export const bullets = (items: string[]): TipTapNode => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});

export const numbered = (items: string[]): TipTapNode => ({
  type: 'orderedList',
  content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});

export const image = (src: string, alt: string, caption?: string): TipTapNode => ({
  type: 'image',
  attrs: { src, alt, title: caption ?? null },
});

export const doc = (...nodes: TipTapNode[]): TipTapDoc => ({
  type: 'doc',
  content: nodes,
});
