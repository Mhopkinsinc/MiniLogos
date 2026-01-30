import { RgbColor } from './types';

export interface AsepriteData {
  width: number;
  height: number;
  palette: RgbColor[];
  pixels: Uint8Array; // Row-major indices
}

export const parseAseprite = async (buffer: ArrayBuffer): Promise<AsepriteData> => {
  const view = new DataView(buffer);
  
  // File Header
  // const fileSize = view.getUint32(0, true);
  const magic = view.getUint16(4, true);
  
  // Basic validation
  if (magic !== 0xA5E0) {
      throw new Error("Invalid Aseprite file header");
  }
  
  // const frames = view.getUint16(6, true);
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  const bpp = view.getUint16(12, true);
  
  if (bpp !== 8) {
      throw new Error("Only 8bpp (Indexed) Aseprite files are supported");
  }

  // Initialize state
  const palette: RgbColor[] = Array(256).fill({ r: 0, g: 0, b: 0 });
  const pixels = new Uint8Array(width * height).fill(0); 

  // We only parse the first frame. 
  // Frame 1 header is at 128 bytes.
  let offset = 128;
  
  if (buffer.byteLength < offset + 16) {
       throw new Error("File too short for frame header");
  }

  // Frame Header
  // const frameSize = view.getUint32(offset, true);
  const frameMagic = view.getUint16(offset + 4, true);
  
  if (frameMagic !== 0xF1FA) {
      throw new Error("Invalid Frame header");
  }
  
  const oldChunks = view.getUint16(offset + 6, true);
  let numChunks = view.getUint32(offset + 12, true);
  if (numChunks === 0) numChunks = oldChunks;
  
  offset += 16; // Skip frame header

  for (let i = 0; i < numChunks; i++) {
    const chunkStart = offset;
    const chunkSize = view.getUint32(offset, true);
    const chunkType = view.getUint16(offset + 4, true);
    
    // Palette Chunk (0x2019)
    if (chunkType === 0x2019) {
      const numEntries = view.getUint32(offset + 6, true);
      const firstIndex = view.getUint32(offset + 10, true);
      
      let pOff = offset + 26;
      for (let c = 0; c < numEntries; c++) {
        if (pOff + 6 > chunkStart + chunkSize) break;

        const flags = view.getUint16(pOff, true);
        const r = view.getUint8(pOff + 2);
        const g = view.getUint8(pOff + 3);
        const b = view.getUint8(pOff + 4);
        
        if (firstIndex + c < 256) {
             palette[firstIndex + c] = { r, g, b };
        }
        
        pOff += 6;
        if (flags & 1) { // Has name
             if (pOff + 2 > chunkStart + chunkSize) break;
             const nameLen = view.getUint16(pOff, true);
             pOff += 2 + nameLen;
        }
      }
    }
    // Cel Chunk (0x2005)
    else if (chunkType === 0x2005) {
        // const layerIndex = view.getUint16(offset + 6, true);
        const xPos = view.getInt16(offset + 8, true);
        const yPos = view.getInt16(offset + 10, true);
        // const opacity = view.getUint8(offset + 12);
        const celType = view.getUint16(offset + 13, true);
        // 0=Raw, 1=Linked, 2=Compressed, 3=CompressedTilemap
        
        // We only support Compressed Image (Type 2) which is standard
        if (celType === 2) { 
            const celWidth = view.getUint16(offset + 22, true);
            const celHeight = view.getUint16(offset + 24, true);
            
            const dataStart = offset + 26;
            const dataEnd = chunkStart + chunkSize;
            const compressedData = new Uint8Array(buffer.slice(dataStart, dataEnd));
            
            try {
                // Decompress
                const ds = new DecompressionStream('deflate');
                const writer = ds.writable.getWriter();
                writer.write(compressedData);
                writer.close();
                
                const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
                const celPixels = new Uint8Array(decompressedBuffer);
                
                // Blit to main pixel array
                for (let cy = 0; cy < celHeight; cy++) {
                    for (let cx = 0; cx < celWidth; cx++) {
                        const destX = xPos + cx;
                        const destY = yPos + cy;
                        
                        if (destX >= 0 && destX < width && destY >= 0 && destY < height) {
                            pixels[destY * width + destX] = celPixels[cy * celWidth + cx];
                        }
                    }
                }
            } catch (e) {
                console.warn("Failed to decompress cel data", e);
            }
        }
    }
    
    offset = chunkStart + chunkSize;
  }

  return { width, height, palette, pixels };
};