import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

// Rasterize the existing brand artwork for KakaoTalk/Open Graph compatibility.
const artwork = readFileSync(new URL('../public/celeb-house-logo.svg', import.meta.url), 'utf8')
const image = new Resvg(artwork, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: true } })
writeFileSync(new URL('../public/og-image.png', import.meta.url), image.render().asPng())
