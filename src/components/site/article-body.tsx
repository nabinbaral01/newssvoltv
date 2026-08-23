import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import type { TipTapMark, TipTapNode } from '@/lib/content';

/**
 * Server-side renderer for TipTap JSON.
 *
 * The editor and this renderer share `.prose-volt` in globals.css, so what an
 * author sees in the composer is what publishes. Anything unknown is skipped
 * rather than dumped as raw JSON.
 */

function applyMarks(text: string, marks: TipTapMark[] | undefined, key: React.Key): React.ReactNode {
  if (!marks?.length) return <React.Fragment key={key}>{text}</React.Fragment>;

  return marks.reduce<React.ReactNode>((node, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong key={key}>{node}</strong>;
      case 'italic':
        return <em key={key}>{node}</em>;
      case 'strike':
        return <s key={key}>{node}</s>;
      case 'code':
        return <code key={key}>{node}</code>;
      case 'underline':
        return <u key={key}>{node}</u>;
      case 'link': {
        const href = String(mark.attrs?.href ?? '#');
        const external = /^https?:\/\//.test(href) && !href.includes('voltv');
        return (
          <a
            key={key}
            href={href}
            {...(external ? { rel: 'noreferrer noopener', target: '_blank' } : {})}
          >
            {node}
          </a>
        );
      }
      default:
        return node;
    }
  }, text);
}

function renderNodes(nodes: TipTapNode[] | undefined): React.ReactNode {
  if (!nodes?.length) return null;
  return nodes.map((node, index) => <RenderNode key={index} node={node} index={index} />);
}

function RenderNode({ node, index }: { node: TipTapNode; index: number }) {
  switch (node.type) {
    case 'text':
      return applyMarks(node.text ?? '', node.marks, index);

    case 'paragraph':
      return <p>{renderNodes(node.content)}</p>;

    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      const Tag = (level === 3 ? 'h3' : level === 4 ? 'h4' : 'h2') as 'h2' | 'h3' | 'h4';
      return <Tag>{renderNodes(node.content)}</Tag>;
    }

    case 'bulletList':
      return <ul>{renderNodes(node.content)}</ul>;

    case 'orderedList':
      return <ol>{renderNodes(node.content)}</ol>;

    case 'listItem':
      return <li>{renderNodes(node.content)}</li>;

    case 'blockquote':
      return <blockquote>{renderNodes(node.content)}</blockquote>;

    case 'codeBlock':
      return (
        <pre>
          <code>{renderNodes(node.content)}</code>
        </pre>
      );

    case 'horizontalRule':
      return <hr className="border-border" />;

    case 'hardBreak':
      return <br />;

    case 'image': {
      const src = String(node.attrs?.src ?? '');
      if (!src) return null;
      const caption = node.attrs?.title ? String(node.attrs.title) : null;
      return (
        <figure className="my-6">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-card border border-border bg-elevated">
            <Image
              src={src}
              alt={String(node.attrs?.alt ?? '')}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
            />
          </div>
          {caption ? (
            <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>
          ) : null}
        </figure>
      );
    }

    case 'youtube': {
      const src = String(node.attrs?.src ?? '');
      const id = src.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/)?.[1];
      if (!id) return null;
      return (
        <div className="my-6 aspect-video w-full overflow-hidden rounded-card border border-border">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title="Embedded video"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="size-full"
          />
        </div>
      );
    }

    /** Inline related-article card, inserted from the editor's embed menu. */
    case 'relatedPost': {
      const href = String(node.attrs?.href ?? '');
      const title = String(node.attrs?.title ?? 'Related story');
      const label = String(node.attrs?.label ?? 'Related');
      if (!href) return null;
      return (
        <aside className="my-6 rounded-card border-l-4 border-accent bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent">{label}</p>
          <Link href={href} className="headline mt-1 block text-xl hover:text-accent">
            {title}
          </Link>
        </aside>
      );
    }

    case 'doc':
      return <>{renderNodes(node.content)}</>;

    default:
      return node.content ? <>{renderNodes(node.content)}</> : null;
  }
}

export function ArticleBody({ body }: { body: unknown }) {
  const doc = body as TipTapNode | null;
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.content)) {
    return <p className="text-muted">This article has no body yet.</p>;
  }
  return <div className="prose-volt max-w-none">{renderNodes(doc.content)}</div>;
}
