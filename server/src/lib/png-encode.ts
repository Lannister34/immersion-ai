import { crc32 } from 'crc';

interface PngChunk {
  name: string;
  data: Uint8Array;
}

/**
 * Encodes PNG chunks into a PNG file format buffer.
 * Port of src/png/encode.js
 */
export default function encode(chunks: PngChunk[]): Uint8Array {
  const uint8 = new Uint8Array(4);
  const int32 = new Int32Array(uint8.buffer);
  const uint32 = new Uint32Array(uint8.buffer);

  let totalSize = 8;
  let idx = totalSize;

  for (let i = 0; i < chunks.length; i++) {
    totalSize += chunks[i].data.length;
    totalSize += 12;
  }

  const output = new Uint8Array(totalSize);

  // PNG signature
  output[0] = 0x89;
  output[1] = 0x50;
  output[2] = 0x4e;
  output[3] = 0x47;
  output[4] = 0x0d;
  output[5] = 0x0a;
  output[6] = 0x1a;
  output[7] = 0x0a;

  for (let i = 0; i < chunks.length; i++) {
    const { name, data } = chunks[i];
    const size = data.length;
    const nameChars = [name.charCodeAt(0), name.charCodeAt(1), name.charCodeAt(2), name.charCodeAt(3)];

    uint32[0] = size;
    output[idx++] = uint8[3];
    output[idx++] = uint8[2];
    output[idx++] = uint8[1];
    output[idx++] = uint8[0];

    output[idx++] = nameChars[0];
    output[idx++] = nameChars[1];
    output[idx++] = nameChars[2];
    output[idx++] = nameChars[3];

    for (let j = 0; j < size; ) {
      output[idx++] = data[j++];
    }

    const crcVal = crc32(Buffer.from(data), crc32(Buffer.from(new Uint8Array(nameChars))));

    int32[0] = crcVal;
    output[idx++] = uint8[3];
    output[idx++] = uint8[2];
    output[idx++] = uint8[1];
    output[idx++] = uint8[0];
  }

  return output;
}
