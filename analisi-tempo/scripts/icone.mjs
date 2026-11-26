// =====================================================================
// Genera le icone PNG dell'app (orologio con lo spicchio di un'ora),
// senza librerie esterne. Viene eseguito prima di "vite build" e crea
// solo le icone che mancano in public/.
// =====================================================================
import { deflateSync } from 'node:zlib'
import { existsSync, writeFileSync } from 'node:fs'

const VERDE = [31, 58, 46]
const CARTA = [246, 245, 241]
const ARANCIO = [234, 88, 12]

// CRC32 richiesto dal formato PNG
const TABELLA = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABELLA[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function blocco(tipo, dati) {
  const lunghezza = Buffer.alloc(4)
  lunghezza.writeUInt32BE(dati.length)
  const corpo = Buffer.concat([Buffer.from(tipo), dati])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([lunghezza, corpo, crc])
}

/** Distanza del punto (px,py) dal segmento (ax,ay)-(bx,by) */
function distanzaSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function colorePixel(x, y, lato, margine) {
  const c = lato / 2
  const r = lato * (margine ? 0.3 : 0.36)
  const dx = x - c
  const dy = y - c
  const d = Math.hypot(dx, dy)
  if (d > r) return VERDE
  const spessore = lato * 0.028
  // lancette: minuti verso le 12, ore verso l'una
  const a1 = -Math.PI / 2
  const a2 = -Math.PI / 2 + Math.PI / 6
  if (
    d < spessore ||
    distanzaSegmento(x, y, c, c, c + Math.cos(a1) * r * 0.78, c + Math.sin(a1) * r * 0.78) < spessore / 2 ||
    distanzaSegmento(x, y, c, c, c + Math.cos(a2) * r * 0.5, c + Math.sin(a2) * r * 0.5) < spessore / 2
  ) {
    return VERDE
  }
  // spicchio arancio tra le 12 e l'una
  const angolo = Math.atan2(dy, dx)
  if (d < r * 0.86 && angolo >= -Math.PI / 2 && angolo <= -Math.PI / 3) return ARANCIO
  return CARTA
}

function png(lato, margine = false) {
  const S = 3 // sottocampionamento per bordi morbidi
  const righe = []
  for (let y = 0; y < lato; y++) {
    const riga = Buffer.alloc(1 + lato * 3) // 0 = nessun filtro
    for (let x = 0; x < lato; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const [cr, cg, cb] = colorePixel(x + (sx + 0.5) / S, y + (sy + 0.5) / S, lato, margine)
          r += cr
          g += cg
          b += cb
        }
      }
      riga.set([r / (S * S), g / (S * S), b / (S * S)].map(Math.round), 1 + x * 3)
    }
    righe.push(riga)
  }
  const intestazione = Buffer.alloc(13)
  intestazione.writeUInt32BE(lato, 0)
  intestazione.writeUInt32BE(lato, 4)
  intestazione.set([8, 2, 0, 0, 0], 8) // 8 bit, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    blocco('IHDR', intestazione),
    blocco('IDAT', deflateSync(Buffer.concat(righe), { level: 9 })),
    blocco('IEND', Buffer.alloc(0)),
  ])
}

const icone = [
  ['public/icona-192.png', 192],
  ['public/icona-512.png', 512],
  ['public/icona-maskable-512.png', 512, true],
  ['public/apple-touch-icon.png', 180],
  ['public/badge-96.png', 96],
]
for (const [file, lato, margine] of icone) {
  if (!existsSync(file)) {
    writeFileSync(file, png(lato, margine))
    console.log('creata', file)
  }
}
