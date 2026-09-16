import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { normalizeEditorContent } from '../../../entities/post/lib/content'
import { slugify } from '../../../entities/post/lib/formatters'
import type { Post, PostStatus } from '../../../entities/post/model/types'
import { fileToDataUrl } from '../../../shared/lib/file'

type PostEditorProps = {
  categories: string[]
  post: Post
  onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdate: (patch: Partial<Post>) => void
}

export function PostEditor({ categories, post, onCoverUpload, onUpdate }: PostEditorProps) {
  const inlineImageRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({
        allowBase64: true,
        inline: false,
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: '본문을 작성하세요. 이미지, 표, 인용문, 색상까지 자유롭게 넣을 수 있습니다.',
      }),
    ],
    content: normalizeEditorContent(post.content),
    editorProps: {
      attributes: {
        class: 'rich-editor-surface',
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate({ content: editor.getHTML() })
    },
  })

  useEffect(() => {
    if (!editor) return

    const nextContent = normalizeEditorContent(post.content)
    if (editor.getHTML() !== nextContent) {
      // 다른 글을 선택했을 때 에디터 내부 문서를 현재 글 내용으로 교체합니다.
      editor.commands.setContent(nextContent, { emitUpdate: false })
    }
  }, [editor, post.content, post.id])

  const uploadInlineImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editor) return

    const src = await fileToDataUrl(file)
    editor.chain().focus().setImage({ src, alt: file.name }).run()
    event.target.value = ''
  }

  const setLink = () => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 주소를 입력하세요.', previousUrl ?? 'https://')

    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const addTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <section className="editor-grid">
      <div className="editor-main">
        <label>
          제목
          <input value={post.title} onChange={(event) => onUpdate({ title: event.target.value })} />
        </label>
        <label>
          요약
          <textarea
            className="excerpt-input"
            value={post.excerpt}
            onChange={(event) => onUpdate({ excerpt: event.target.value })}
            rows={3}
          />
        </label>

        <div className="toolbar rich-toolbar" aria-label="글 편집 도구">
          <ToolbarButton active={editor?.isActive('bold')} label="굵게" onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('italic')} label="기울임" onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('underline')} label="밑줄" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('code')} label="코드" onClick={() => editor?.chain().focus().toggleCode().run()}>
            <Code2 size={16} />
          </ToolbarButton>

          <span className="toolbar-divider" />

          <ToolbarButton active={editor?.isActive('paragraph')} label="본문" onClick={() => editor?.chain().focus().setParagraph().run()}>
            <Pilcrow size={16} />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive('heading', { level: 1 })}
            label="제목 1"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 size={16} />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive('heading', { level: 2 })}
            label="제목 2"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 size={16} />
          </ToolbarButton>

          <span className="toolbar-divider" />

          <ToolbarButton active={editor?.isActive('bulletList')} label="불릿 목록" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('orderedList')} label="번호 목록" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('blockquote')} label="인용" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote size={16} />
          </ToolbarButton>

          <span className="toolbar-divider" />

          <ToolbarButton active={editor?.isActive({ textAlign: 'left' })} label="왼쪽 정렬" onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
            <AlignLeft size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive({ textAlign: 'center' })} label="가운데 정렬" onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
            <AlignCenter size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive({ textAlign: 'right' })} label="오른쪽 정렬" onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
            <AlignRight size={16} />
          </ToolbarButton>

          <span className="toolbar-divider" />

          <ToolbarButton label="링크" onClick={setLink}>
            <Link size={16} />
          </ToolbarButton>
          <ToolbarButton label="이미지 삽입" onClick={() => inlineImageRef.current?.click()}>
            <ImagePlus size={16} />
          </ToolbarButton>
          <ToolbarButton label="표 삽입" onClick={addTable}>
            <Table2 size={16} />
          </ToolbarButton>

          <label className="color-control" title="글자 색상">
            <Palette size={16} />
            <input type="color" defaultValue="#ff6a00" onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()} />
          </label>
          <ToolbarButton label="하이라이트" onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fff3bf' }).run()}>
            <Highlighter size={16} />
          </ToolbarButton>

          <span className="toolbar-divider" />

          <ToolbarButton label="되돌리기" onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 size={16} />
          </ToolbarButton>
          <ToolbarButton label="다시 실행" onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 size={16} />
          </ToolbarButton>

          <input ref={inlineImageRef} className="hidden-input" type="file" accept="image/*" onChange={uploadInlineImage} />
        </div>

        <label>
          본문
          <EditorContent editor={editor} className="rich-editor" />
        </label>
      </div>

      <aside className="editor-side">
        <label>
          상태
          <select value={post.status} onChange={(event) => onUpdate({ status: event.target.value as PostStatus })}>
            <option value="draft">초안</option>
            <option value="published">발행</option>
            <option value="archived">보관</option>
          </select>
        </label>
        <label>
          슬러그
          <input value={post.slug} onChange={(event) => onUpdate({ slug: slugify(event.target.value) })} />
        </label>
        <label>
          카테고리
          <select value={post.category} onChange={(event) => onUpdate({ category: event.target.value })}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          태그
          <input
            value={post.tags.join(', ')}
            onChange={(event) =>
              onUpdate({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })
            }
            placeholder="react, essay, daily"
          />
        </label>
        <label className="cover-uploader">
          <span>커버 이미지</span>
          <input type="file" accept="image/*" onChange={onCoverUpload} />
          {post.coverImage ? <img src={post.coverImage} alt="" /> : <ImagePlus size={32} />}
        </label>
      </aside>
    </section>
  )
}

function ToolbarButton({
  active,
  children,
  label,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={active ? 'is-active' : ''} type="button" title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}
