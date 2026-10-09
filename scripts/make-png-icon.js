const fs = require('fs');
const zlib = require('zlib');

function createSolidPng(width, height, r, g, b) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      // Emerald gradient from top to bottom
      const factor = y / height;
      const currentR = Math.round(r * (1 - factor * 0.4));
      const currentG = Math.round(g * (1 - factor * 0.2));
      const currentB = Math.round(b * (1 - factor * 0.4));

      rawData[offset++] = currentR;
      rawData[offset++] = currentG;
      rawData[offset++] = currentB;
      rawData[offset++] = 255;
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
    buf.writeUInt32BE(crc >>> 0, 8 + len);
    return buf;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation
function crc32(buf) {
  let c = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (c ^ buf[n]) & 0xffffffff;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Cor esmeralda financeira: R=16, G=185, B=129
const p192 = createSolidPng(192, 192, 16, 185, 129);
const p512 = createSolidPng(512, 512, 16, 185, 129);
const p180 = createSolidPng(180, 180, 16, 185, 129);

fs.writeFileSync('public/icon-192.png', p192);
fs.writeFileSync('public/icon-512.png', p512);
fs.writeFileSync('public/apple-touch-icon.png', p180);

console.log('PNG Icons successfully generated!');

