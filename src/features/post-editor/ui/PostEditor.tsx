import Color from '@tiptap/extension-color'
import { BackgroundColor } from '@tiptap/extension-text-style/background-color'
import { FontSize } from '@tiptap/extension-text-style/font-size'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { Italic as ItalicExtension } from '@tiptap/extension-italic'
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
  Braces,
  Code2,
  Eraser,
  ExternalLink,
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
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { normalizeEditorContent } from '../../../entities/post/lib/content'
import { slugify } from '../../../entities/post/lib/formatters'
import type { Post, PostStatus, ProductLink } from '../../../entities/post/model/types'
import { imageFileToOptimizedDataUrl } from '../../../shared/lib/file'
import { createId } from '../../../shared/lib/id'

type PostEditorProps = {
  categories: string[]
  post: Post
  onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdate: (patch: Partial<Post>) => void
}

const FONT_SIZES = [
  { label: '기본', value: '' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
]

const TEXT_COLORS = ['#111827', '#475569', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9', '#6366f1', '#a855f7']
const HIGHLIGHT_COLORS = ['#fff3bf', '#fde68a', '#fecdd3', '#bbf7d0', '#bae6fd', '#ddd6fe']
const DETAIL_FRAME_COUNT = 4

function replaceDetailSlot(values: string[], index: number, value: string) {
  return Array.from({ length: DETAIL_FRAME_COUNT }, (_, slotIndex) => (
    slotIndex === index ? value : values[slotIndex] ?? ''
  ))
}

function hasCompleteFourCut(post: Post) {
  return Array.from({ length: DETAIL_FRAME_COUNT }, (_, index) => (
    Boolean(post.detailImages[index]) && Boolean(post.detailDescriptions[index]?.trim())
  )).every(Boolean)
}

export function PostEditor({ categories, post, onCoverUpload, onUpdate }: PostEditorProps) {
  const inlineImageRef = useRef<HTMLInputElement>(null)
  const editorContentRef = useRef(normalizeEditorContent(post.content))
  const selectedCategory = post.category.trim()
  const categoryOptions = useMemo(() => {
    const names = [selectedCategory, ...categories]
      .map((category) => category.trim())
      .filter(Boolean)

    return Array.from(new Set(names.length ? names : ['분류 없음'])).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [categories, selectedCategory])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          defaultLanguage: 'javascript',
          enableTabIndentation: true,
          HTMLAttributes: {
            class: 'blog-code-block',
            'data-language': 'JAVASCRIPT',
          },
          tabSize: 2,
        },
        heading: { levels: [1, 2, 3] },
        italic: false,
        link: false,
        underline: false,
      }),
      ItalicExtension.configure({
        HTMLAttributes: {
          class: 'text-italic',
        },
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      BackgroundColor,
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
        placeholder: '상품 상세, 장점, 구매 전 체크 포인트를 작성하세요. 이미지, 표, 코드블럭까지 자유롭게 넣을 수 있습니다.',
      }),
    ],
    content: normalizeEditorContent(post.content),
    editorProps: {
      attributes: {
        class: 'rich-editor-surface',
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      editorContentRef.current = content
      onUpdate({ content })
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const nextContent = normalizeEditorContent(post.content)
    if (editorContentRef.current === nextContent) return

    // 다른 상품/서버 데이터로 바뀐 경우에만 에디터 문서를 교체합니다.
    editorContentRef.current = nextContent
    editor.commands.setContent(nextContent, { emitUpdate: false })
  }, [editor, post.content, post.id])

  const uploadInlineImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editor) return

    const src = await imageFileToOptimizedDataUrl(file, 1600, 0.78)
    editor.chain().focus().setImage({ src, alt: file.name }).run()
    event.target.value = ''
  }

  const uploadDetailFrameImage = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    try {
      const image = await imageFileToOptimizedDataUrl(file, 1600, 0.8)
      onUpdate({ detailImages: replaceDetailSlot(post.detailImages, index, image) })
    } catch {
      window.alert('상세 이미지를 처리하지 못했습니다. 다른 이미지를 선택해 주세요.')
    }
  }

  const clearDetailFrameImage = (index: number) => {
    onUpdate({ detailImages: replaceDetailSlot(post.detailImages, index, '') })
  }

  const updateDetailFrameDescription = (index: number, description: string) => {
    onUpdate({ detailDescriptions: replaceDetailSlot(post.detailDescriptions, index, description) })
  }

  const changePostStatus = (status: PostStatus) => {
    if (status === 'published' && !hasCompleteFourCut(post)) {
      window.alert('상품을 발행하려면 비올레 네컷 사진 4장과 각 사진의 설명을 모두 등록해 주세요.')
      return
    }

    onUpdate({ status })
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

  const insertJavaScriptBlock = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'codeBlock',
        attrs: { language: 'javascript' },
        content: [{ type: 'text', text: 'const product = "VIOLE";\nconsole.log(product);' }],
      })
      .run()
  }

  const currentFontSize = (editor?.getAttributes('textStyle').fontSize as string | undefined) ?? ''

  const setFontSize = (fontSize: string) => {
    const chain = editor?.chain().focus()
    if (!chain) return

    if (fontSize) {
      chain.setFontSize(fontSize).run()
      return
    }

    chain.unsetFontSize().run()
  }

  const setTextColor = (color: string) => {
    editor?.chain().focus().setColor(color).run()
  }

  const setHighlightColor = (color: string) => {
    editor?.chain().focus().setHighlight({ color }).run()
  }

  const clearFormatting = () => {
    editor?.chain().focus().unsetColor().unsetBackgroundColor().unsetHighlight().unsetFontSize().unsetAllMarks().clearNodes().run()
  }

  const addProductLink = () => {
    onUpdate({
      productLinks: [
        ...post.productLinks,
        {
          id: createId(),
          mall: '쿠팡',
          price: '',
          label: '최저가 구매하기',
          href: '',
          badge: '추천',
        },
      ],
    })
  }

  const updateProductLink = (linkId: string, patch: Partial<ProductLink>) => {
    onUpdate({
      productLinks: post.productLinks.map((link) => (link.id === linkId ? { ...link, ...patch } : link)),
    })
  }

  const removeProductLink = (linkId: string) => {
    onUpdate({ productLinks: post.productLinks.filter((link) => link.id !== linkId) })
  }

  return (
    <section className="editor-grid">
      <div className="editor-main">
        <label>
          상품명
          <input value={post.title} onChange={(event) => onUpdate({ title: event.target.value })} />
        </label>
        <label>
          한 줄 혜택/요약
          <textarea
            className="excerpt-input"
            value={post.excerpt}
            onChange={(event) => onUpdate({ excerpt: event.target.value })}
            rows={3}
          />
        </label>

        <section className="viole-four-cut-admin" aria-label="비올레 네컷 상품 상세 등록">
          <header>
            <div>
              <span>PRODUCT DETAIL TEMPLATE</span>
              <h2>비올레 네컷</h2>
              <p>사진 4장과 각 컷의 상품 설명을 모두 입력해 주세요.</p>
            </div>
            <strong>{post.detailImages.filter(Boolean).length} / 4</strong>
          </header>

          <div className="viole-four-cut-admin-frames">
            {Array.from({ length: 4 }, (_, index) => {
              const image = post.detailImages[index] ?? ''
              const description = post.detailDescriptions[index] ?? ''

              return (
                <article className={image && description.trim() ? 'is-complete' : ''} key={index}>
                  <div className="viole-four-cut-admin-number">
                    <span>CUT</span>
                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                  </div>
                  <label className="viole-four-cut-admin-image">
                    <input type="file" accept="image/*" onChange={(event) => uploadDetailFrameImage(index, event)} />
                    {image ? (
                      <img src={image} alt={`${index + 1}번째 상세 이미지 미리보기`} />
                    ) : (
                      <span>
                        <ImagePlus size={24} />
                        사진 선택
                      </span>
                    )}
                  </label>
                  <label className="viole-four-cut-admin-copy">
                    <span>이 사진의 상품 설명</span>
                    <textarea
                      value={description}
                      rows={5}
                      maxLength={240}
                      placeholder="사진에서 보여주는 특징, 소재, 사용감 등을 설명해 주세요."
                      onChange={(event) => updateDetailFrameDescription(index, event.target.value)}
                    />
                    <small>{description.length} / 240</small>
                  </label>
                  {image && (
                    <button type="button" aria-label={`${index + 1}번째 사진 삭제`} onClick={() => clearDetailFrameImage(index)}>
                      <Trash2 size={14} /> 사진 삭제
                    </button>
                  )}
                </article>
              )
            })}
          </div>

          <footer>
            <span>VIOLE FOUR CUT</span>
            <strong>비올레 네컷</strong>
          </footer>
        </section>

        <div className="toolbar rich-toolbar" aria-label="상품 상세 편집 도구">
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
          <ToolbarButton active={editor?.isActive('codeBlock')} label="JavaScript 코드블럭" onClick={insertJavaScriptBlock}>
            <Braces size={16} />
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

          <label className="font-size-control" title="글자 크기">
            <span>크기</span>
            <select value={currentFontSize} onChange={(event) => setFontSize(event.target.value)}>
              {FONT_SIZES.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <ColorSwatches
            colors={TEXT_COLORS}
            icon={<Palette size={15} />}
            label="글자색"
            onSelect={setTextColor}
          />

          <ColorSwatches
            colors={HIGHLIGHT_COLORS}
            icon={<Highlighter size={15} />}
            label="형광펜"
            onSelect={setHighlightColor}
          />

          <ToolbarButton label="서식 제거" onClick={clearFormatting}>
            <Eraser size={16} />
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
          추가 상품 설명 <small>(선택)</small>
          <EditorContent editor={editor} className="rich-editor" />
        </label>
      </div>

      <aside className="editor-side">
        <label>
          상태
          <select value={post.status} onChange={(event) => changePostStatus(event.target.value as PostStatus)}>
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
          광고 모델 / 셀럽
          <select value={selectedCategory} onChange={(event) => onUpdate({ category: event.target.value })}>
            {!selectedCategory && (
              <option value="" disabled>
                셀럽 선택
              </option>
            )}
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          태그/혜택 키워드
          <input
            value={post.tags.join(', ')}
            onChange={(event) =>
              onUpdate({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })
            }
            placeholder="쿠팡, 카드할인, 오늘특가"
          />
        </label>
        <section className="product-link-admin" aria-label="구매 링크 관리">
          <div>
            <span>제휴 링크</span>
            <button type="button" onClick={addProductLink}>
              <ExternalLink size={15} /> 링크 추가
            </button>
          </div>
          <label className="product-link-url">
            구매바 상단 문구
            <input
              value={post.purchaseTitle}
              placeholder="지금 가장 좋은 가격으로 이동"
              onChange={(event) => onUpdate({ purchaseTitle: event.target.value })}
            />
          </label>
          {post.productLinks.length ? (
            post.productLinks.map((link, index) => (
              <div className="product-link-card" key={link.id}>
                <strong>구매처 {index + 1}</strong>
                <label>
                  쇼핑몰
                  <input value={link.mall} placeholder="쿠팡, G마켓, 11번가" onChange={(event) => updateProductLink(link.id, { mall: event.target.value })} />
                </label>
                <label>
                  가격
                  <input value={link.price} placeholder="129,000원" onChange={(event) => updateProductLink(link.id, { price: event.target.value })} />
                </label>
                <label>
                  버튼 문구
                  <input value={link.label} placeholder="최저가 구매하기" onChange={(event) => updateProductLink(link.id, { label: event.target.value })} />
                </label>
                <label>
                  배지
                  <input value={link.badge} placeholder="쿠폰가, 로켓배송, 추천" onChange={(event) => updateProductLink(link.id, { badge: event.target.value })} />
                </label>
                <label className="product-link-url">
                  제휴 URL
                  <input value={link.href} placeholder="https://..." onChange={(event) => updateProductLink(link.id, { href: event.target.value })} />
                </label>
                <button className="product-link-remove" type="button" onClick={() => removeProductLink(link.id)}>
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            ))
          ) : (
            <p className="product-link-empty">쿠팡, G마켓, 11번가 등 제휴 링크를 추가하면 공개 화면에 구매 버튼이 표시됩니다.</p>
          )}
        </section>
        <label className="cover-uploader">
          <span>대표 이미지</span>
          <input type="file" accept="image/*" onChange={onCoverUpload} />
          {post.coverImage ? (
            <img src={post.coverImage} alt="" />
          ) : (
            <span className="cover-uploader-empty" aria-hidden="true">
              <strong>COVER</strong>
              <b>+</b>
              <small>01 / MAIN</small>
            </span>
          )}
        </label>
      </aside>
    </section>
  )
}

function ColorSwatches({
  colors,
  icon,
  label,
  onSelect,
}: {
  colors: string[]
  icon: ReactNode
  label: string
  onSelect: (color: string) => void
}) {
  return (
    <div className="color-swatch-group" aria-label={label}>
      <span>{icon}</span>
      {colors.map((color) => (
        <button
          aria-label={`${label} ${color}`}
          key={color}
          style={{ '--swatch-color': color } as CSSProperties}
          type="button"
          onClick={() => onSelect(color)}
        />
      ))}
      <label title={`${label} 직접 선택`}>
        <input type="color" onChange={(event) => onSelect(event.target.value)} />
      </label>
    </div>
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
