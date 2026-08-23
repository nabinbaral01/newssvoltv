'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold, Code, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2,
  Newspaper, Quote, Redo2, Strikethrough, Undo2, Video,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { RelatedPost } from './related-post-node';
import { cn } from '@/lib/utils';

type ToolbarButton = {
  key: string;
  label: string;
  icon: React.ElementType;
  run: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
};

const BUTTONS: ToolbarButton[] = [
  { key: 'bold', label: 'Bold', icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive('bold') },
  { key: 'italic', label: 'Italic', icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive('italic') },
  { key: 'strike', label: 'Strikethrough', icon: Strikethrough, run: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive('strike') },
  { key: 'h2', label: 'Heading 2', icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e) => e.isActive('heading', { level: 2 }) },
  { key: 'h3', label: 'Heading 3', icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), isActive: (e) => e.isActive('heading', { level: 3 }) },
  { key: 'bullet', label: 'Bullet list', icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive('bulletList') },
  { key: 'ordered', label: 'Numbered list', icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive('orderedList') },
  { key: 'quote', label: 'Pull quote', icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive('blockquote') },
  { key: 'code', label: 'Code block', icon: Code, run: (e) => e.chain().focus().toggleCodeBlock().run(), isActive: (e) => e.isActive('codeBlock') },
];

async function uploadImage(file: File): Promise<{ url: string } | null> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/admin/media', { method: 'POST', body });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    toast.error(data.error ?? 'Upload failed.');
    return null;
  }
  const data = await res.json();
  return { url: data.asset.url as string };
}

export function TipTapEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
}: {
  value: unknown;
  onChange: (doc: unknown) => void;
  placeholder?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer noopener' } }),
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ nocookie: true, width: 720, height: 405 }),
      Placeholder.configure({ placeholder }),
      RelatedPost,
    ],
    content: (value as object) ?? undefined,
    editorProps: {
      attributes: {
        class: 'prose-volt min-h-[28rem] max-w-none px-4 py-4 focus:outline-none',
        spellcheck: 'true',
      },
      // Drag an image straight onto the canvas.
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        );
        if (!files.length) return false;
        event.preventDefault();
        void (async () => {
          setUploading(true);
          for (const file of files) {
            const uploaded = await uploadImage(file);
            if (uploaded) {
              const alt = window.prompt('Alt text for this image (describe it for screen readers)') ?? '';
              editorRef.current?.chain().focus().setImage({ src: uploaded.url, alt }).run();
            }
          }
          setUploading(false);
        })();
        return true;
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        );
        if (!files.length) return false;
        event.preventDefault();
        void (async () => {
          setUploading(true);
          for (const file of files) {
            const uploaded = await uploadImage(file);
            if (uploaded) editorRef.current?.chain().focus().setImage({ src: uploaded.url, alt: '' }).run();
          }
          setUploading(false);
        })();
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON()),
  });

  const editorRef = React.useRef<Editor | null>(null);
  React.useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  if (!editor) {
    return (
      <div className="grid h-96 place-items-center rounded-card border border-border bg-surface text-sm text-muted">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    );
  }

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL', previous ?? 'https://');
    if (href === null) return;
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const embedYoutube = () => {
    const src = window.prompt('YouTube URL');
    if (src) editor.commands.setYoutubeVideo({ src });
  };

  const insertRelated = () => {
    const href = window.prompt('Link to the related article (path or URL)');
    if (!href) return;
    const title = window.prompt('Headline to show on the card') ?? href;
    editor.commands.insertRelatedPost({ href, title, label: 'Read this next' });
  };

  return (
    <div className="rounded-card border border-border bg-surface">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-surface/95 p-1.5 backdrop-blur">
        {BUTTONS.map((button) => {
          const Icon = button.icon;
          const active = button.isActive?.(editor);
          return (
            <button
              key={button.key}
              type="button"
              title={button.label}
              aria-label={button.label}
              aria-pressed={active}
              onClick={() => button.run(editor)}
              className={cn(
                'grid size-8 place-items-center rounded transition-colors',
                active ? 'bg-elevated text-accent' : 'text-muted hover:bg-elevated hover:text-fg',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          );
        })}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <button
          type="button"
          title="Add link"
          aria-label="Add link"
          onClick={setLink}
          className={cn(
            'grid size-8 place-items-center rounded transition-colors',
            editor.isActive('link') ? 'bg-elevated text-accent' : 'text-muted hover:bg-elevated hover:text-fg',
          )}
        >
          <Link2 className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          title="Insert image"
          aria-label="Insert image"
          onClick={() => fileInputRef.current?.click()}
          className="grid size-8 place-items-center rounded text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        </button>

        <button
          type="button"
          title="Embed YouTube"
          aria-label="Embed YouTube"
          onClick={embedYoutube}
          className="grid size-8 place-items-center rounded text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          <Video className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          title="Insert related article card"
          aria-label="Insert related article card"
          onClick={insertRelated}
          className="grid size-8 place-items-center rounded text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          <Newspaper className="size-4" aria-hidden />
        </button>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="grid size-8 place-items-center rounded text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-40"
        >
          <Undo2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          title="Redo"
          aria-label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="grid size-8 place-items-center rounded text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-40"
        >
          <Redo2 className="size-4" aria-hidden />
        </button>

        <span className="ml-auto px-2 text-[11px] text-muted">
          {editor.storage.characterCount?.words?.() ?? editor.getText().split(/\s+/).filter(Boolean).length} words
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setUploading(true);
          const uploaded = await uploadImage(file);
          setUploading(false);
          if (!uploaded) return;
          const alt = window.prompt('Alt text (describe the image for screen readers)') ?? '';
          editor.chain().focus().setImage({ src: uploaded.url, alt }).run();
        }}
      />

      <EditorContent editor={editor} />
    </div>
  );
}
