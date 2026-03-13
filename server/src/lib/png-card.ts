import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import extract from 'png-chunks-extract';
import PNGtext from 'png-chunk-text';
import encode from './png-encode.js';

/**
 * Writes character metadata to a PNG image buffer.
 * @param image PNG image buffer
 * @param data Character JSON string
 * @returns PNG image buffer with metadata
 */
export function write(image: Buffer, data: string): Buffer {
  const chunks = extract(new Uint8Array(image));
  const tEXtChunks = chunks.filter(
    (chunk: { name: string }) => chunk.name === 'tEXt',
  );

  // Remove existing tEXt chunks (chara/ccv3)
  for (const tEXtChunk of tEXtChunks) {
    const decoded = PNGtext.decode(tEXtChunk.data);
    if (
      decoded.keyword.toLowerCase() === 'chara' ||
      decoded.keyword.toLowerCase() === 'ccv3'
    ) {
      chunks.splice(chunks.indexOf(tEXtChunk), 1);
    }
  }

  // Add v2 chunk before IEND
  const base64EncodedData = Buffer.from(data, 'utf8').toString('base64');
  chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));

  // Try adding v3 chunk
  try {
    const v3Data = JSON.parse(data);
    v3Data.spec = 'chara_card_v3';
    v3Data.spec_version = '3.0';
    const v3Base64 = Buffer.from(JSON.stringify(v3Data), 'utf8').toString(
      'base64',
    );
    chunks.splice(-1, 0, PNGtext.encode('ccv3', v3Base64));
  } catch {
    // Ignore v3 errors
  }

  return Buffer.from(encode(chunks));
}

/**
 * Reads character metadata from a PNG image buffer.
 * Supports both V2 (chara) and V3 (ccv3). V3 takes precedence.
 * @param image PNG image buffer
 * @returns Character data JSON string
 */
export function read(image: Buffer): string {
  const chunks = extract(new Uint8Array(image));
  const textChunks = chunks
    .filter((chunk: { name: string }) => chunk.name === 'tEXt')
    .map((chunk: { data: Uint8Array }) => PNGtext.decode(chunk.data));

  if (textChunks.length === 0) {
    throw new Error('No PNG metadata.');
  }

  const ccv3Index = textChunks.findIndex(
    (chunk: { keyword: string }) => chunk.keyword.toLowerCase() === 'ccv3',
  );
  if (ccv3Index > -1) {
    return Buffer.from(textChunks[ccv3Index].text, 'base64').toString('utf8');
  }

  const charaIndex = textChunks.findIndex(
    (chunk: { keyword: string }) => chunk.keyword.toLowerCase() === 'chara',
  );
  if (charaIndex > -1) {
    return Buffer.from(textChunks[charaIndex].text, 'base64').toString('utf8');
  }

  throw new Error('No character data in PNG metadata.');
}

/**
 * Parses a character card image file and returns character data.
 * @param cardPath Path to the PNG file
 * @returns Character data JSON string
 */
export function parse(cardPath: string): string {
  const buffer = fs.readFileSync(cardPath);
  return read(buffer);
}
