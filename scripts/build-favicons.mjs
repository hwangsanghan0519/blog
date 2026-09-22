import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

// Keep search, browser and home-screen icons derived from the same brand artwork.
const artwork = readFileSync(new URL('../public/powerpuffceleb-icon.svg', import.meta.url), 'utf8')
const render = (size) => new Resvg(artwork, { fitTo: { mode: 'width', value: size } }).render().asPng()
const write = (name, bytes) => writeFileSync(new URL(`../public/${name}`, import.meta.url), bytes)

for (const [name, size] of [
  ['favicon-96x96.png', 96],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) write(name, render(size))

// ICO directory with PNG frames for browsers requesting the conventional URL.
const sizes = [32, 48]
const frames = sizes.map(render)
const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
frames.forEach((frame, index) => {
  const entry = 6 + index * 16
  header[entry] = sizes[index]
  header[entry + 1] = sizes[index]
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(frame.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += frame.length
})
write('favicon.ico', Buffer.concat([header, ...frames]))
