declare module 'png-chunks-extract' {
  interface PngChunk {
    name: string;
    data: Uint8Array;
  }
  function extract(data: Uint8Array): PngChunk[];
  export = extract;
}

declare module 'png-chunk-text' {
  interface DecodedText {
    keyword: string;
    text: string;
  }
  const PNGtext: {
    encode(keyword: string, text: string): { name: string; data: Uint8Array };
    decode(data: Uint8Array): DecodedText;
  };
  export = PNGtext;
}
