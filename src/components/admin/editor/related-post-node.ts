import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    relatedPost: {
      insertRelatedPost: (attrs: { href: string; title: string; label?: string }) => ReturnType;
    };
  }
}

/**
 * Inline "read this next" card. Stored as its own node rather than as markup so
 * the public renderer can restyle every one of them at once, and so a moved or
 * renamed post can be fixed with a query instead of a find-and-replace.
 */
export const RelatedPost = Node.create({
  name: 'relatedPost',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: '' },
      title: { default: '' },
      label: { default: 'Related' },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-related-post]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-related-post': '',
        class: 'my-4 rounded border-l-4 border-accent bg-elevated p-3',
      }),
      ['span', { class: 'block text-[11px] font-bold uppercase tracking-widest text-accent' }, HTMLAttributes.label ?? 'Related'],
      ['span', { class: 'block text-lg font-semibold' }, HTMLAttributes.title ?? ''],
    ];
  },

  addCommands() {
    return {
      insertRelatedPost:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
