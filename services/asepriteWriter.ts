import { JimData, RgbColor } from './types';

const WORD = 2;
const DWORD = 4;

function setWord(view: DataView, offset: number, value: number) {
    view.setUint16(offset, value, true); // Little Endian
}

function setDword(view: DataView, offset: number, value: number) {
    view.setUint32(offset, value, true); // Little Endian
}

function setInt16(view: DataView, offset: number, value: number) {
    view.setInt16(offset, value, true);
}

function stringToBuffer(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

async function compressData(data: Uint8Array): Promise<Uint8Array> {
    // The 'deflate' format in CompressionStream corresponds to the ZLIB Compressed Data Format (RFC 1950).
    // This includes the header and checksum required by Aseprite.
    // We do not need to manually wrap it.
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

export const createAsepriteBlob = async (jim: JimData, mode: 'map' | 'tileset', activePaletteIdx: number, transparentBg: boolean = true): Promise<Blob> => {
    // 1. Prepare Data
    let width: number, height: number;
    let pixels: Uint8Array;
    let palette: RgbColor[];

    if (mode === 'map') {
        width = jim.mapWidth * 8;
        height = jim.mapHeight * 8;
        pixels = new Uint8Array(width * height);
        
        if (activePaletteIdx >= 0) {
            // Forced Palette Mode: Use specific palette (16 colors)
            // This overrides the individual cell palette indices.
            palette = jim.palettes[activePaletteIdx] || jim.palettes[0];

            for (let y = 0; y < jim.mapHeight; y++) {
                for (let x = 0; x < jim.mapWidth; x++) {
                    const cell = jim.mapData[y][x];
                    const tile = jim.tiles[cell.tileIndex] || [];
                    
                    // Draw tile 8x8 using raw indices (0-15)
                    for (let ty = 0; ty < 8; ty++) {
                        for (let tx = 0; tx < 8; tx++) {
                            // Flip logic
                            const srcY = cell.vFlip ? 7 - ty : ty;
                            const srcX = cell.hFlip ? 7 - tx : tx;
                            
                            const colorIdx = tile[srcY]?.[srcX] || 0;
                            
                            const destX = x * 8 + tx;
                            const destY = y * 8 + ty;
                            
                            pixels[destY * width + destX] = colorIdx;
                        }
                    }
                }
            }
        } else {
            // Native Mode: Use all 4 palettes flattened (64 colors)
            // Preserves the original multi-palette look of the map.
            palette = jim.palettes.flat();

            // Generate pixel data
            for (let y = 0; y < jim.mapHeight; y++) {
                for (let x = 0; x < jim.mapWidth; x++) {
                    const cell = jim.mapData[y][x];
                    const tile = jim.tiles[cell.tileIndex] || [];
                    const palOffset = cell.paletteIndex * 16;
                    
                    // Draw tile 8x8 with palette offset
                    for (let ty = 0; ty < 8; ty++) {
                        for (let tx = 0; tx < 8; tx++) {
                            // Flip logic
                            const srcY = cell.vFlip ? 7 - ty : ty;
                            const srcX = cell.hFlip ? 7 - tx : tx;
                            
                            const colorIdx = tile[srcY]?.[srcX] || 0;
                            
                            const destX = x * 8 + tx;
                            const destY = y * 8 + ty;
                            
                            pixels[destY * width + destX] = palOffset + colorIdx;
                        }
                    }
                }
            }
        }
    } else {
        // Tileset Mode
        const tilesPerRow = 16;
        const numTiles = jim.tiles.length;
        
        // Calculate columns based on actual tile count, capped at tilesPerRow
        const cols = numTiles > 0 ? Math.min(numTiles, tilesPerRow) : 1;
        const rows = numTiles > 0 ? Math.ceil(numTiles / tilesPerRow) : 1;

        width = cols * 8;
        height = rows * 8;
        pixels = new Uint8Array(width * height);
        
        // Use active palette only. If activePaletteIdx is -1 (from Native selection), fallback to 0.
        palette = jim.palettes[activePaletteIdx] || jim.palettes[0];
        // Ensure we got a valid palette array if index was invalid somehow
        if (!palette) palette = jim.palettes[0];

        // Generate pixel data
        for (let i = 0; i < numTiles; i++) {
            const tile = jim.tiles[i];
            const tileX = (i % tilesPerRow) * 8;
            const tileY = Math.floor(i / tilesPerRow) * 8;

            for (let ty = 0; ty < 8; ty++) {
                for (let tx = 0; tx < 8; tx++) {
                    const colorIdx = tile[ty]?.[tx] || 0;
                    const destX = tileX + tx;
                    const destY = tileY + ty;
                    
                    // Safety check
                    if (destX < width && destY < height) {
                        pixels[destY * width + destX] = colorIdx; // 0-15
                    }
                }
            }
        }
    }

    // 2. Compress Pixel Data (Cel Chunk Content)
    const compressedPixels = await compressData(pixels);

    // 3. Construct Chunks
    
    // --- Palette Chunk (0x2019) ---
    // Header (6) + Size info (20) + Entries (numColors * 6)
    const numColors = palette.length;
    const paletteChunkLen = 6 + 20 + (numColors * 6);
    const paletteChunk = new Uint8Array(paletteChunkLen);
    const pv = new DataView(paletteChunk.buffer);
    
    setDword(pv, 0, paletteChunkLen);
    setWord(pv, 4, 0x2019);
    setDword(pv, 6, numColors);
    setDword(pv, 10, 0); // First
    setDword(pv, 14, numColors - 1); // Last
    // 18-25 reserved (0)

    let pOff = 26;
    for(let i=0; i<numColors; i++) {
        setWord(pv, pOff, 0); // Flags
        const c = palette[i];
        pv.setUint8(pOff+2, c.r);
        pv.setUint8(pOff+3, c.g);
        pv.setUint8(pOff+4, c.b);
        
        // Calculate Alpha
        let alpha = 255;
        if (transparentBg) {
            // If Native mode (64 colors), indices 0, 16, 32, 48 are transparent (start of each sub-palette).
            // If Single palette (16 colors), index 0 is transparent.
            if (numColors === 64) {
                if (i % 16 === 0) alpha = 0;
            } else {
                if (i === 0) alpha = 0;
            }
        }
        pv.setUint8(pOff+5, alpha); 

        pOff += 6;
    }

    // --- Layer Chunk (0x2004) ---
    // Header (6) + Data (18) + NameLen (2) + Name
    const layerName = "Layer 1";
    const layerNameBytes = stringToBuffer(layerName);
    const layerChunkLen = 6 + 18 + 2 + layerNameBytes.length;
    const layerChunk = new Uint8Array(layerChunkLen);
    const lv = new DataView(layerChunk.buffer);

    setDword(lv, 0, layerChunkLen);
    setWord(lv, 4, 0x2004);
    setWord(lv, 6, 1); // Visible
    setWord(lv, 8, 0); // Image Layer
    setWord(lv, 10, 0); // Child level
    setWord(lv, 12, 0); // Default width (ignore)
    setWord(lv, 14, 0); // Default height (ignore)
    setWord(lv, 16, 0); // Blend mode normal
    lv.setUint8(18, 255); // Opacity
    // 19-21 reserved
    setWord(lv, 22, layerNameBytes.length);
    layerChunk.set(layerNameBytes, 24);

    // --- Cel Chunk (0x2005) ---
    // Header (6) + Cel Info (20) + Compressed Data
    const celChunkLen = 6 + 20 + compressedPixels.length;
    const celChunk = new Uint8Array(celChunkLen);
    const cv = new DataView(celChunk.buffer);

    setDword(cv, 0, celChunkLen);
    setWord(cv, 4, 0x2005);
    setWord(cv, 6, 0); // Layer Index
    setInt16(cv, 8, 0); // X
    setInt16(cv, 10, 0); // Y
    cv.setUint8(12, 255); // Opacity
    setWord(cv, 13, 2); // Type 2 = Compressed Image
    // 15-21 reserved
    setWord(cv, 22, width);
    setWord(cv, 24, height);
    celChunk.set(compressedPixels, 26);

    // --- Frame Header ---
    const numChunks = 3;
    const frameSize = 16 + paletteChunkLen + layerChunkLen + celChunkLen;
    const frameHeader = new Uint8Array(16);
    const fv = new DataView(frameHeader.buffer);
    setDword(fv, 0, frameSize);
    setWord(fv, 4, 0xF1FA);
    setWord(fv, 6, numChunks); // Old chunks field
    setWord(fv, 8, 100); // Duration
    setDword(fv, 12, numChunks); // New chunks field (redundant but safe)

    // --- File Header ---
    const header = new Uint8Array(128);
    const hv = new DataView(header.buffer);
    setDword(hv, 0, 128 + frameSize);
    setWord(hv, 4, 0xA5E0);
    setWord(hv, 6, 1); // Frames
    setWord(hv, 8, width);
    setWord(hv, 10, height);
    setWord(hv, 12, 8); // 8bpp Indexed
    setDword(hv, 14, 1); // Flags (Layer opacity valid)
    // Transparent index: If transparency enabled, set to 0. If not, set to 255 (assumed unused in 16/64 color modes).
    setWord(hv, 24, transparentBg ? 0 : 255); 
    setWord(hv, 28, numColors); // Number of colors
    hv.setUint8(30, 1); // Pixel width
    hv.setUint8(31, 1); // Pixel height
    setWord(hv, 36, 8); // Grid W
    setWord(hv, 38, 8); // Grid H

    // Combine
    return new Blob([header, frameHeader, paletteChunk, layerChunk, celChunk], { type: 'application/octet-stream' });
}