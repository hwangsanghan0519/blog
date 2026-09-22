import { writeFileSync } from 'node:fs'

// Original geometric letterforms. The wordmark uses paths, so its shape is
// identical on mobile, desktop and social previews without loading a font.
const letters = {
  P: 'M0 90V0H43Q64 0 64 22V37Q64 59 43 59H23V90ZM23 19V40H38Q42 40 42 35V24Q42 19 38 19Z',
  O: 'M20 0H44Q64 0 64 21V69Q64 90 44 90H20Q0 90 0 69V21Q0 0 20 0ZM26 20Q23 20 23 24V66Q23 70 26 70H38Q41 70 41 66V24Q41 20 38 20Z',
  W: 'M0 0H23L28 49L38 11H55L65 49L70 0H93L79 90H57L46 53L36 90H14Z',
  E: 'M0 0H62V20H23V34H56V54H23V70H62V90H0Z',
  R: 'M0 90V0H43Q64 0 64 22V34Q64 50 51 55L68 90H43L29 60H23V90ZM23 19V40H38Q42 40 42 35V24Q42 19 38 19Z',
  U: 'M0 0H23V65Q23 70 28 70H36Q41 70 41 65V0H64V69Q64 90 43 90H21Q0 90 0 69Z',
  F: 'M0 0H62V20H23V37H56V58H23V90H0Z',
  C: 'M21 0H43Q64 0 64 21V30H41V25Q41 20 36 20H28Q23 20 23 25V65Q23 70 28 70H36Q41 70 41 65V60H64V69Q64 90 43 90H21Q0 90 0 69V21Q0 0 21 0Z',
  L: 'M0 0H23V70H62V90H0Z',
  B: 'M0 90V0H42Q63 0 63 21V29Q63 40 54 44Q66 49 66 62V68Q66 90 44 90ZM23 19V35H36Q41 35 41 30V24Q41 19 36 19ZM23 54V71H38Q43 71 43 66V59Q43 54 38 54Z',
}

function word(text, x, y, width, height, fill) {
  let cursor = 0
  const paths = [...text].map((letter) => {
    if (letter === ' ') { cursor += 24; return '' }
    const path = `<path transform="translate(${cursor} 0)" d="${letters[letter]}"/>`
    cursor += (letter === 'W' ? 93 : letter === 'R' ? 68 : 64) + 7
    return path
  }).join('')
  const lean = height * Math.tan(Math.PI / 18)
  const outline = fill === '#fff9ff' || fill.startsWith('url(') ? 'stroke="#62407e" stroke-width="6" stroke-linejoin="round" paint-order="stroke fill"' : ''
  return `<g fill="${fill}" ${outline} fill-rule="evenodd" transform="translate(${x + lean} ${y}) skewX(-10) scale(${(width - lean) / (cursor - 7)} ${height / 90})">${paths}</g>`
}

// Nested candy hearts and an ink outline echo a playful cartoon title while
// staying in the storefront's soft lavender, pink and mint palette.
const heart = 'M50 91C38 80 10 61 5 39C0 18 13 6 29 7C40 7 46 14 50 22C56 10 64 6 75 7C93 8 101 25 94 43C85 64 63 81 50 91Z'
function symbol(x, y, size, id = 'heart') {
  return `<g transform="translate(${x} ${y}) scale(${size / 100})">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffc5e1"/><stop offset="1" stop-color="#ee97ca"/></linearGradient></defs>
    <g transform="rotate(-9 50 50)">
      <path d="${heart}" transform="translate(1 4)" fill="#9868b2" opacity=".35"/>
      <path d="${heart}" fill="url(#${id})" stroke="#684381" stroke-width="3" stroke-linejoin="round"/>
      <path d="${heart}" transform="translate(50 47) scale(.71) translate(-50 -47)" fill="#d5c1ff" stroke="#85609f" stroke-width="2.8"/>
      <path d="${heart}" transform="translate(50 46) scale(.43) translate(-50 -47)" fill="#c2eee4" stroke="#85609f" stroke-width="3"/>
      <path d="M18 26Q21 18 28 19" fill="none" stroke="#fff8ff" stroke-width="4" stroke-linecap="round"/>
    </g>
  </g>`
}

function svg(width, height, content, label = '파워퍼프셀럽 POWER PUFF CELEB') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">\n${content}\n</svg>\n`
}
function write(path, content) {
  writeFileSync(new URL(`../${path}`, import.meta.url), content)
}

const horizontal = (fill) => word('POWER PUFF', 24, 14, 572, 72, fill) + word('CELEB', 24, 100, 412, 76, fill)
write('src/assets/powerpuffceleb-logo.svg', svg(620, 190,
  `<g transform="translate(0 5)">${horizontal('#dcb0e9')}</g>${horizontal('#fff9ff')}${symbol(486, 95, 82)}`))

const stacked = (fill) => word('POWER PUFF', 34, 28, 552, 108, fill) + word('CELEB', 34, 159, 414, 116, fill)
write('src/assets/powerpuffceleb-logo-stacked.svg', svg(620, 320,
  `<g transform="translate(0 7)">${stacked('#dcb0e9')}</g>${stacked('#fff9ff')}${symbol(476, 172, 108)}`))

write('public/powerpuffceleb-icon.svg', svg(64, 64,
  `<rect width="64" height="64" rx="18" fill="#f8f0ff"/>${symbol(7, 6, 50, 'icon-heart')}`))

const socialWordmark = (fill) => word('POWER PUFF', 88, 134, 1024, 125, fill) + word('CELEB', 88, 287, 727, 138, fill)
write('public/powerpuffceleb-logo.svg', svg(1200, 630, `
  <defs><linearGradient id="social-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffafd"/><stop offset="1" stop-color="#eee2ff"/></linearGradient><linearGradient id="social-ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff9ff"/><stop offset="1" stop-color="#ffe0f1"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#social-bg)"/>
  <circle cx="1105" cy="65" r="230" fill="#e8d7fc" opacity=".65"/>
  <circle cx="30" cy="606" r="190" fill="#f6ddec" opacity=".55"/>
  <path d="${heart}" transform="translate(970 36) scale(.7) rotate(14 50 50)" fill="#fff" opacity=".55"/>
  <text x="108" y="83" fill="#ad8dbf" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="5">CELEB · INFLUENCER · CURATED PICKS</text>
  <g transform="translate(0 9)">${socialWordmark('#d9bdf0')}</g>
  ${socialWordmark('url(#social-ink)')}
  ${symbol(900, 286, 151, 'social-heart')}
  <path d="M104 464H1094" stroke="#d4b8e6" stroke-width="2"/>
  <text x="106" y="519" fill="#79558e" font-family="Arial, sans-serif" font-size="30" font-weight="700">파워퍼프셀럽</text>
  <text x="108" y="558" fill="#a386b2" font-family="Arial, sans-serif" font-size="22">나의 최애가 선택한 아이템</text>
`, '파워퍼프셀럽 — 연예인과 인플루언서가 선택한 상품'))
