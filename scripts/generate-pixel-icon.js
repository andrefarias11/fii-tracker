const fs = require('fs');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c ^ buf[i]) & 0xffffffff;
    c = crcTable[c & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPng(width, height, drawFn) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Pintor do Ícone do FII Tracker
function drawFiiIcon(x, y, w, h) {
  // Normalizar coordenadas de 0 a 1
  const nx = x / w;
  const ny = y / h;

  // 1. Fundo Gradiente Elegante (Preto OLED para Verde Esmeralda Profundo)
  const distCenter = Math.hypot(nx - 0.5, ny - 0.5);
  let r = Math.round(9 + (1 - distCenter) * 12);
  let g = Math.round(15 + (1 - ny) * 75);
  let b = Math.round(20 + (1 - nx) * 35);

  // 2. Base dos Prédios (Y de 0.35 até 0.85)
  // Prédio Esquerdo: nx de 0.22 a 0.38, ny de 0.45 a 0.82
  if (nx >= 0.22 && nx <= 0.38 && ny >= 0.45 && ny <= 0.82) {
    r = 30; g = 41; b = 59;
    // Borda
    if (nx <= 0.235 || nx >= 0.365 || ny <= 0.465) {
      r = 51; g = 65; b = 85;
    }
  }

  // Prédio Central (Principal - Esmeralda): nx de 0.40 a 0.60, ny de 0.28 a 0.82
  if (nx >= 0.40 && nx <= 0.60 && ny >= 0.28 && ny <= 0.82) {
    r = 16; g = 185; b = 129; // Emerald 500
    // Janelas iluminadas (Grade de quadradinhos)
    const winX = ((nx - 0.42) * 100) % 5;
    const winY = ((ny - 0.32) * 100) % 7;
    if (winX >= 1 && winX <= 3 && winY >= 1 && winY <= 4) {
      r = 204; g = 251; b = 241; // Teal 100 brilhante
    }
    // Borda superior
    if (ny <= 0.30 || nx <= 0.415 || nx >= 0.585) {
      r = 52; g = 211; b = 153; // Emerald 400
    }
  }

  // Prédio Direito: nx de 0.62 a 0.78, ny de 0.52 a 0.82
  if (nx >= 0.62 && nx <= 0.78 && ny >= 0.52 && ny <= 0.82) {
    r = 30; g = 41; b = 59;
    if (nx <= 0.635 || nx >= 0.765 || ny <= 0.535) {
      r = 51; g = 65; b = 85;
    }
  }

  // 3. Linha de Valorização Ascendente (Gráfico de Alta)
  // Reta ligando (0.18, 0.72) até (0.82, 0.22)
  const lineY = 0.72 - (nx - 0.18) * 0.78;
  const distToLine = Math.abs(ny - lineY);
  if (nx >= 0.18 && nx <= 0.82 && distToLine < 0.022) {
    r = 52; g = 211; b = 153; // Linha verde neon
  }

  // Seta na ponta do gráfico (nx entre 0.76 e 0.84, ny entre 0.18 e 0.26)
  if (nx >= 0.76 && nx <= 0.84 && ny >= 0.18 && ny <= 0.26) {
    r = 16; g = 185; b = 129;
  }

  return [r, g, b, 255];
}

// Gerar os ícones
console.log('Gerando ícones de alta resolução...');
const icon180 = createPng(180, 180, drawFiiIcon);
const icon192 = createPng(192, 192, drawFiiIcon);
const icon512 = createPng(512, 512, drawFiiIcon);

fs.writeFileSync('public/apple-touch-icon.png', icon180);
fs.writeFileSync('public/apple-touch-icon-precomposed.png', icon180);
fs.writeFileSync('public/icon-192.png', icon192);
fs.writeFileSync('public/icon-512.png', icon512);

console.log('✅ apple-touch-icon.png (180x180) e ícones PWA gerados com sucesso!');
