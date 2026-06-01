// Lazy TipTap rich-text editor for the Our Story body (D-19).
//
// This module is imported ONLY via React.lazy from SiteContent so the heavy
// TipTap/ProseMirror code-splits into the admin chunk and NEVER enters the
// public bundle (RESEARCH Pitfall 5). The enabled marks are constrained to the
// DOMPurify allow-list in lib/sanitizeHtml.ts (bold / italic / link / bullet
// list / ordered list) so nothing the owner authors gets silently stripped on
// the public render.
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

/** A single ghost toolbar button that reflects its mark's active state. */
function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted",
        active ? "bg-muted text-primary" : "text-foreground/70",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Controlled TipTap editor. Emits HTML via `onChange` on every update; the
 * parent persists that HTML to site_content.our_story_body, and the public
 * Our Story page renders it back through sanitizeRichText (DOMPurify).
 */
export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles bold/italic/bulletList/orderedList AND the link
      // mark — exactly the D-19 allow-list. We open links in a new tab and force
      // a safe rel; sanitizeRichText re-asserts rel="noopener noreferrer" on
      // render regardless.
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }: { editor: Editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[180px] px-3 py-2 focus:outline-none",
      },
    },
  });

  const toggleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Enter the link URL (https://…)");
    if (!url) return;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input bg-transparent">
      <div className="flex items-center gap-1 border-b border-input px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold size={16} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic size={16} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={toggleLink}
          label="Link"
        >
          <LinkIcon size={16} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List size={16} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Ordered list"
        >
          <ListOrdered size={16} strokeWidth={1.75} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
