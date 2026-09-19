import { ImagePlus, Trash2 } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { GMARKET_SAMPLE_BANNER, GMARKET_SAMPLE_BANNER_IMAGE } from '../model/config'
import type { AdBannerSettings, HeroVideoSettings } from '../model/types'

type HeroVideoAdminPanelProps = {
  settings: HeroVideoSettings
  onStickerImageUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdate: (patch: Partial<HeroVideoSettings>) => void
}

/** 영상 설정 폼은 저장 방식을 알지 못하고 변경값만 상위 모델에 전달합니다. */
export function HeroVideoAdminPanel({ settings, onStickerImageUpload, onUpdate }: HeroVideoAdminPanelProps) {
  return (
    <section className="ad-admin-panel hero-video-admin" aria-label="자동재생 영상 설정">
      <div>
        <span>TREND VIDEO</span>
        <strong>헤더 아래 풀 영상</strong>
      </div>

      <label className="ad-admin-toggle">
        <input
          checked={settings.enabled}
          type="checkbox"
          onChange={(event) => onUpdate({ enabled: event.target.checked, visibilityConfigured: true })}
        />
        노출
      </label>

      <label>
        영상 라벨
        <input value={settings.eyebrow} placeholder="NOW PLAYING" onChange={(event) => onUpdate({ eyebrow: event.target.value })} />
      </label>

      <label>
        영상 제목
        <input value={settings.title} placeholder="VIOLE VIDEO PICK" onChange={(event) => onUpdate({ title: event.target.value })} />
      </label>

      <label className="ad-admin-wide hero-video-url-field">
        유튜브 주소
        <input
          inputMode="url"
          value={settings.youtubeUrl}
          placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
          onChange={(event) => {
            const youtubeUrl = event.target.value
            onUpdate({
              youtubeUrl,
              ...(!settings.visibilityConfigured ? { enabled: Boolean(youtubeUrl.trim()) } : {}),
            })
          }}
        />
        <small>주소를 등록하면 자동 노출됩니다. 직접 노출 스위치를 끈 이후에는 해당 설정을 유지합니다.</small>
      </label>

      <label className="ad-admin-image hero-video-sticker-image">
        <span>플로팅 스티커 이미지</span>
        <input type="file" accept="image/*" onChange={onStickerImageUpload} />
        {settings.stickerImage ? <img src={settings.stickerImage} alt="등록된 영상 스티커 미리보기" /> : <ImagePlus size={24} />}
      </label>

      {settings.stickerImage && (
        <button className="ad-admin-remove hero-video-sticker-remove" type="button" onClick={() => onUpdate({ stickerImage: '' })}>
          <Trash2 size={16} /> 스티커 삭제
        </button>
      )}

      <label className="ad-admin-wide hero-video-sticker-link">
        스티커 이동 링크
        <input
          inputMode="url"
          value={settings.stickerHref}
          placeholder="https://link.coupang.com/..."
          onChange={(event) => onUpdate({ stickerHref: event.target.value })}
        />
        <small>이미지와 링크가 모두 등록되면 영상 오른쪽 상단에 클릭 가능한 스티커가 표시됩니다.</small>
      </label>
    </section>
  )
}

type AdBannerAdminPanelProps = {
  banner: AdBannerSettings
  index: number
  onImageUpload: (index: number, event: ChangeEvent<HTMLInputElement>) => void
  onUpdate: (index: number, patch: Partial<AdBannerSettings>) => void
}

export function AdBannerAdminPanel({ banner, index, onImageUpload, onUpdate }: AdBannerAdminPanelProps) {
  const colorPickerValue = /^#[0-9a-fA-F]{6}$/.test(banner.backgroundColor) ? banner.backgroundColor : '#ffffff'
  const usesDefaultBannerImage = banner.image === GMARKET_SAMPLE_BANNER_IMAGE

  return (
    <section className="ad-admin-panel" aria-label="띠배너 설정">
      <div>
        <span>광고 띠배너 {index + 1}</span>
        <strong>배너 슬롯 {index + 1}</strong>
      </div>

      <label className="ad-admin-toggle">
        <input checked={banner.enabled} type="checkbox" onChange={(event) => onUpdate(index, { enabled: event.target.checked })} />
        노출
      </label>

      <label>
        위치
        <select value={banner.placement} onChange={(event) => onUpdate(index, { placement: event.target.value as AdBannerSettings['placement'] })}>
          <option value="both">헤더+푸터</option>
          <option value="header">헤더 아래</option>
          <option value="footer">푸터 위</option>
        </select>
      </label>

      <label>
        라벨
        <input value={banner.eyebrow} onChange={(event) => onUpdate(index, { eyebrow: event.target.value })} />
      </label>
      <label>
        제목
        <input value={banner.title} onChange={(event) => onUpdate(index, { title: event.target.value })} />
      </label>
      <label className="ad-admin-wide">
        설명
        <input value={banner.description} onChange={(event) => onUpdate(index, { description: event.target.value })} />
      </label>
      <label>
        버튼 문구
        <input value={banner.ctaLabel} onChange={(event) => onUpdate(index, { ctaLabel: event.target.value })} />
      </label>
      <label className="ad-admin-wide">
        링크
        <input value={banner.href} placeholder="https://example.com" onChange={(event) => onUpdate(index, { href: event.target.value })} />
      </label>
      <label className="ad-admin-embed">
        <span>제휴 광고 태그</span>
        <textarea
          rows={5}
          spellCheck={false}
          value={banner.embedCode}
          placeholder={'쿠팡 등에서 발급받은 <script>…</script> 또는 <iframe>…</iframe> 코드를 붙여 넣으세요.'}
          onChange={(event) => onUpdate(index, { embedCode: event.target.value })}
        />
        <small>태그가 입력되면 이미지·텍스트 배너보다 우선 표시되며 광고 전용 보안 영역 안에서 실행됩니다.</small>
        {banner.embedCode && (
          <button type="button" onClick={() => onUpdate(index, { embedCode: '' })}>
            태그 비우기
          </button>
        )}
      </label>
      <label className="ad-admin-color">
        배경색
        <span>
          <input type="color" value={colorPickerValue} onChange={(event) => onUpdate(index, { backgroundColor: event.target.value })} />
          <input value={banner.backgroundColor} onChange={(event) => onUpdate(index, { backgroundColor: event.target.value })} />
        </span>
      </label>
      <label className="ad-admin-preset">
        <input
          checked={usesDefaultBannerImage}
          type="checkbox"
          onChange={(event) =>
            onUpdate(
              index,
              event.target.checked
                ? {
                    enabled: true,
                    image: GMARKET_SAMPLE_BANNER_IMAGE,
                    backgroundColor: GMARKET_SAMPLE_BANNER.backgroundColor ?? '#9b72ea',
                  }
                : { image: '' },
            )
          }
        />
        기본 배너 이미지 사용
      </label>
      <label className="ad-admin-image">
        <span>배너 이미지</span>
        <input type="file" accept="image/*" onChange={(event) => onImageUpload(index, event)} />
        {banner.image ? <img src={banner.image} alt="" /> : <ImagePlus size={24} />}
      </label>
      {banner.image && (
        <button className="ad-admin-remove" type="button" onClick={() => onUpdate(index, { image: '' })}>
          <Trash2 size={16} /> 이미지 삭제
        </button>
      )}
    </section>
  )
}
