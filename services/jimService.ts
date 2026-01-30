import { JimData, RgbColor, TileData, MapCell, JimMetadata, Palette } from './types';
import { AsepriteData } from './asepriteParser';

// --- Helper Functions ---

function parseGenesisColor(word: number): RgbColor {
  // 0BGR format: 0000 BBB GGG RRR (bits)
  const b = ((word >> 9) & 0x7) * 36;
  const g = ((word >> 5) & 0x7) * 36;
  const r = ((word >> 1) & 0x7) * 36;
  return { r, g, b };
}

function rgbToGenesisColor(color: RgbColor): number {
  const rGen = Math.min(7, Math.floor(color.r / 36));
  const gGen = Math.min(7, Math.floor(color.g / 36));
  const bGen = Math.min(7, Math.floor(color.b / 36));
  return (bGen << 9) | (gGen << 5) | (rGen << 1);
}

function decodeTile(data: Uint8Array): TileData {
  const pixels: TileData = [];
  for (let row = 0; row < 8; row++) {
    const rowPixels: number[] = [];
    for (let col = 0; col < 4; col++) {
      const byte = data[row * 4 + col];
      // High nibble first
      rowPixels.push((byte >> 4) & 0x0f);
      rowPixels.push(byte & 0x0f);
    }
    pixels.push(rowPixels);
  }
  return pixels;
}

function encodeTile(pixels: TileData): Uint8Array {
  const data = new Uint8Array(32);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const p1 = pixels[row][col * 2] & 0x0f;
      const p2 = pixels[row][col * 2 + 1] & 0x0f;
      data[row * 4 + col] = (p1 << 4) | p2;
    }
  }
  return data;
}

// --- Main Parsing/Writing Functions ---

export const parseJimFile = (buffer: ArrayBuffer): JimData => {
  const view = new DataView(buffer);
  
  // Header
  const palOffset = view.getUint32(0, false); // Big Endian
  const mapOffset = view.getUint32(4, false);
  const numStamps = view.getUint16(8, false);

  // Parse Tiles
  const tiles: TileData[] = [];
  const tileStart = 10;
  const tileBytes = new Uint8Array(buffer);
  
  for (let i = 0; i < numStamps; i++) {
    const offset = tileStart + i * 32;
    const tileChunk = tileBytes.slice(offset, offset + 32);
    tiles.push(decodeTile(tileChunk));
  }

  // Parse Palettes
  const palettes: RgbColor[][] = [];
  for (let palIdx = 0; palIdx < 4; palIdx++) {
    const currentPalette: RgbColor[] = [];
    for (let colIdx = 0; colIdx < 16; colIdx++) {
      const offset = palOffset + (palIdx * 32) + (colIdx * 2);
      const colorWord = view.getUint16(offset, false);
      currentPalette.push(parseGenesisColor(colorWord));
    }
    palettes.push(currentPalette);
  }

  // Parse Map
  const mapWidth = view.getUint16(mapOffset, false);
  const mapHeight = view.getUint16(mapOffset + 2, false);
  const mapData: MapCell[][] = [];
  const mapDataStart = mapOffset + 4;

  for (let y = 0; y < mapHeight; y++) {
    const row: MapCell[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const offset = mapDataStart + (y * mapWidth + x) * 2;
      const cell = view.getUint16(offset, false);

      const priority = ((cell >> 15) & 1) === 1;
      const paletteIndex = (cell >> 13) & 3;
      const vFlip = ((cell >> 12) & 1) === 1;
      const hFlip = ((cell >> 11) & 1) === 1;
      const tileIndex = cell & 0x7ff;

      row.push({
        tileIndex,
        paletteIndex,
        hFlip,
        vFlip,
        priority
      });
    }
    mapData.push(row);
  }

  return {
    palettes,
    tiles,
    mapWidth,
    mapHeight,
    mapData
  };
};

export const createJimFile = (jim: JimData): Uint8Array => {
  // Calculate offsets
  const numStamps = jim.tiles.length;
  const stampDataSize = numStamps * 32;
  const palOffset = 10 + stampDataSize;
  const mapOffset = palOffset + 128; // 4 palettes * 16 colors * 2 bytes = 128
  
  // Calculate total size to allocate buffer
  // Header (10) + Tiles (numStamps * 32) + Palettes (128) + MapHeader (4) + MapData (width * height * 2)
  const mapDataSize = jim.mapWidth * jim.mapHeight * 2;
  const totalSize = mapOffset + 4 + mapDataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // 1. Write Header
  view.setUint32(0, palOffset, false);
  view.setUint32(4, mapOffset, false);
  view.setUint16(8, numStamps, false);

  // 2. Write Tile Data
  let currentOffset = 10;
  for (const tile of jim.tiles) {
    const encoded = encodeTile(tile);
    bytes.set(encoded, currentOffset);
    currentOffset += 32;
  }

  // 3. Write Palette Data
  currentOffset = palOffset;
  for (const palette of jim.palettes) {
    for (const color of palette) {
      const word = rgbToGenesisColor(color);
      view.setUint16(currentOffset, word, false);
      currentOffset += 2;
    }
  }

  // 4. Write Map Header
  currentOffset = mapOffset;
  view.setUint16(currentOffset, jim.mapWidth, false);
  view.setUint16(currentOffset + 2, jim.mapHeight, false);
  currentOffset += 4;

  // 5. Write Map Data
  for (const row of jim.mapData) {
    for (const cell of row) {
      let cellWord = cell.tileIndex & 0x7ff;
      if (cell.hFlip) cellWord |= (1 << 11);
      if (cell.vFlip) cellWord |= (1 << 12);
      cellWord |= ((cell.paletteIndex & 3) << 13);
      if (cell.priority) cellWord |= (1 << 15);

      view.setUint16(currentOffset, cellWord, false);
      currentOffset += 2;
    }
  }

  return bytes;
};

// --- Rendering & Export ---

export const renderMapToCanvas = (jim: JimData, canvas: HTMLCanvasElement, forcePaletteIndex?: number, transparentBg: boolean = true) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = jim.mapWidth * 8;
  const height = jim.mapHeight * 8;
  canvas.width = width;
  canvas.height = height;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let mapY = 0; mapY < jim.mapHeight; mapY++) {
    for (let mapX = 0; mapX < jim.mapWidth; mapX++) {
      const cell = jim.mapData[mapY][mapX];
      
      // Get Tile
      let tile = jim.tiles[cell.tileIndex];
      if (!tile) {
         // Create dummy blank tile if index out of bounds
         tile = Array(8).fill(Array(8).fill(0));
      }

      // Get Palette
      // If forcePaletteIndex is provided (and valid), it overrides the cell's palette index
      const pIdx = (forcePaletteIndex !== undefined && forcePaletteIndex >= 0) 
        ? forcePaletteIndex 
        : cell.paletteIndex;
        
      const palette = jim.palettes[pIdx] || jim.palettes[0];

      // Draw Tile Pixels
      for (let ty = 0; ty < 8; ty++) {
        for (let tx = 0; tx < 8; tx++) {
          // Handle flipping logic by swapping coordinates
          const srcY = cell.vFlip ? 7 - ty : ty;
          const srcX = cell.hFlip ? 7 - tx : tx;
          
          const colorIdx = tile[srcY][srcX];
          const color = palette[colorIdx] || { r: 0, g: 0, b: 0 };

          const destX = mapX * 8 + tx;
          const destY = mapY * 8 + ty;
          const idx = (destY * width + destX) * 4;

          data[idx] = color.r;
          data[idx + 1] = color.g;
          data[idx + 2] = color.b;
          // Apply transparency if enabled and color index is 0
          data[idx + 3] = (transparentBg && colorIdx === 0) ? 0 : 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
};

export const renderTilesetToCanvas = (jim: JimData, canvas: HTMLCanvasElement, paletteIndex: number = 0, spacing: number = 0, transparentBg: boolean = true) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const tilesPerRow = 16;
  const numTiles = jim.tiles.length;
  
  // Calculate dimensions with spacing
  // If fewer tiles than a row, shrink width to fit
  const cols = numTiles < tilesPerRow ? numTiles : tilesPerRow;
  const rows = Math.ceil(numTiles / tilesPerRow);
  
  const width = cols * 8 + (cols > 0 ? (cols - 1) * spacing : 0);
  const height = rows * 8 + (rows > 0 ? (rows - 1) * spacing : 0);

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;
  const palette = jim.palettes[paletteIndex] || jim.palettes[0];

  for (let i = 0; i < numTiles; i++) {
    const tile = jim.tiles[i];
    const col = i % tilesPerRow;
    const row = Math.floor(i / tilesPerRow);
    
    // Calculate position including spacing
    const tileX = col * (8 + spacing);
    const tileY = row * (8 + spacing);

    for (let ty = 0; ty < 8; ty++) {
      for (let tx = 0; tx < 8; tx++) {
        // Safety check if tile data is malformed
        const colorIdx = (tile[ty] && tile[ty][tx]) !== undefined ? tile[ty][tx] : 0;
        const color = palette[colorIdx] || { r: 0, g: 0, b: 0 };

        const destX = tileX + tx;
        const destY = tileY + ty;
        const idx = (destY * canvas.width + destX) * 4;

        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        // Apply transparency if enabled and color index is 0
        data[idx + 3] = (transparentBg && colorIdx === 0) ? 0 : 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
};

export const renderPalettesToCanvas = (jim: JimData, canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const swatchSize = 16;
  const width = 16 * swatchSize;
  const height = 4 * swatchSize;

  canvas.width = width;
  canvas.height = height;
  
  // Fill background opaque
  ctx.fillStyle = '#1e293b'; 
  ctx.fillRect(0, 0, width, height);

  jim.palettes.forEach((palette, pIdx) => {
    palette.forEach((color, cIdx) => {
      ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      ctx.fillRect(cIdx * swatchSize, pIdx * swatchSize, swatchSize, swatchSize);
    });
  });
};

export const generateMetadata = (jim: JimData): JimMetadata => {
  return {
    map_width: jim.mapWidth,
    map_height: jim.mapHeight,
    num_tiles: jim.tiles.length,
    palettes: jim.palettes.map(pal => pal.map(c => [c.r, c.g, c.b])),
    cells: jim.mapData.map(row => row.map(cell => ({
      tile: cell.tileIndex,
      palette: cell.paletteIndex,
      hflip: cell.hFlip ? 1 : 0,
      vflip: cell.vFlip ? 1 : 0,
      priority: cell.priority ? 1 : 0
    })))
  };
};

// --- Importing PNG & Regeneration ---

// Calculate Euclidean distance between two colors
const colorDist = (c1: RgbColor, c2: RgbColor) => {
  return Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2);
};

// Find nearest color index and return both index and error distance
const findNearestColorWithDist = (target: RgbColor, palette: Palette): { index: number, distance: number } => {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dist = colorDist(target, palette[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return { index: bestIdx, distance: bestDist };
};

// Tile Comparison Utilities for Deduplication
const areTilesEqual = (t1: TileData, t2: TileData): boolean => {
  for(let y=0; y<8; y++) {
      for(let x=0; x<8; x++) {
          if (t1[y][x] !== t2[y][x]) return false;
      }
  }
  return true;
};

// Generate flipped versions of a tile
const getFlippedVariants = (tile: TileData) => {
  const h = tile.map(row => [...row].reverse());
  const v = [...tile].reverse();
  const hv = v.map(row => [...row].reverse());
  return { h, v, hv };
};

export const updateJimFromImage = (
  originalJim: JimData, 
  imageData: ImageData
): JimData => {
  // We will regenerate the tileset and map layout completely.
  // However, we will preserve the original Palettes to maintain system integrity.
  // This means the image pixels will be snapped to the nearest existing palette colors.
  
  const width = originalJim.mapWidth;
  const height = originalJim.mapHeight;
  const imgW = imageData.width;
  const imgH = imageData.height;

  // New structures
  const newTiles: TileData[] = [];
  const newMap: MapCell[][] = [];

  // Helper to check if a tile exists
  const findExistingTile = (candidate: TileData): { index: number, hFlip: boolean, vFlip: boolean } | null => {
    for (let i = 0; i < newTiles.length; i++) {
      const existing = newTiles[i];
      // Exact match
      if (areTilesEqual(existing, candidate)) return { index: i, hFlip: false, vFlip: false };
      
      // Check flips
      const { h, v, hv } = getFlippedVariants(existing);
      if (areTilesEqual(h, candidate)) return { index: i, hFlip: true, vFlip: false };
      if (areTilesEqual(v, candidate)) return { index: i, hFlip: false, vFlip: true };
      if (areTilesEqual(hv, candidate)) return { index: i, hFlip: true, vFlip: true };
    }
    return null;
  };

  for (let mapY = 0; mapY < height; mapY++) {
    const mapRow: MapCell[] = [];
    for (let mapX = 0; mapX < width; mapX++) {
      
      // 1. Extract raw RGB pixels for this 8x8 block
      const blockPixels: RgbColor[][] = [];
      for (let y = 0; y < 8; y++) {
        const row: RgbColor[] = [];
        for (let x = 0; x < 8; x++) {
          const idx = ((mapY * 8 + y) * imgW + (mapX * 8 + x)) * 4;
          row.push({
            r: imageData.data[idx],
            g: imageData.data[idx + 1],
            b: imageData.data[idx + 2]
          });
        }
        blockPixels.push(row);
      }

      // 2. Determine best Palette (0-3)
      // We check which palette results in the lowest color distance error for this block
      let bestPaletteIdx = 0;
      let minTotalError = Infinity;
      let bestTileIndices: TileData = [];

      for (let p = 0; p < 4; p++) {
        const currentPalette = originalJim.palettes[p];
        let currentError = 0;
        const currentIndices: TileData = [];

        for (let y = 0; y < 8; y++) {
          const rowIndices: number[] = [];
          for (let x = 0; x < 8; x++) {
            const { index, distance } = findNearestColorWithDist(blockPixels[y][x], currentPalette);
            currentError += distance;
            rowIndices.push(index);
          }
          currentIndices.push(rowIndices);
        }

        if (currentError < minTotalError) {
          minTotalError = currentError;
          bestPaletteIdx = p;
          bestTileIndices = currentIndices;
        }
      }

      // 3. Deduplicate Tile
      // Check if this tile configuration already exists in our newTiles set
      let tileIndex = -1;
      let hFlip = false;
      let vFlip = false;

      const existing = findExistingTile(bestTileIndices);
      if (existing) {
        tileIndex = existing.index;
        hFlip = existing.hFlip;
        vFlip = existing.vFlip;
      } else {
        // Create new tile
        tileIndex = newTiles.length;
        newTiles.push(bestTileIndices);
      }

      // 4. Create Map Cell
      mapRow.push({
        tileIndex,
        paletteIndex: bestPaletteIdx,
        hFlip,
        vFlip,
        priority: false // Cannot infer priority from image, reset to default
      });
    }
    newMap.push(mapRow);
  }

  return {
    ...originalJim,
    tiles: newTiles,
    mapData: newMap
  };
};

export const convertAsepriteToJim = (ase: AsepriteData, forceUnique: boolean = false): JimData => {
  // 1. Convert Palettes
  // We take the first 64 colors of the Aseprite palette
  const palettes: Palette[] = [];
  
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const pal: RgbColor[] = [];
    for (let cIdx = 0; cIdx < 16; cIdx++) {
      const globalIdx = pIdx * 16 + cIdx;
      const originalColor = ase.palette[globalIdx] || { r: 0, g: 0, b: 0 };
      // Quantize to Genesis Color Space to ensure fidelity
      const genWord = rgbToGenesisColor(originalColor);
      pal.push(parseGenesisColor(genWord));
    }
    palettes.push(pal);
  }

  // 2. Build Tiles and Map
  // Since Aseprite pixels are indexed 0-255, we determine the sub-palette (0-3) based on index range.
  
  const mapWidth = Math.ceil(ase.width / 8);
  const mapHeight = Math.ceil(ase.height / 8);
  
  const newTiles: TileData[] = [];
  const newMap: MapCell[][] = [];

  // Helper to check if a tile exists (Deduplication)
  const findExistingTile = (candidate: TileData): { index: number, hFlip: boolean, vFlip: boolean } | null => {
    for (let i = 0; i < newTiles.length; i++) {
      const existing = newTiles[i];
      if (areTilesEqual(existing, candidate)) return { index: i, hFlip: false, vFlip: false };
      
      const { h, v, hv } = getFlippedVariants(existing);
      if (areTilesEqual(h, candidate)) return { index: i, hFlip: true, vFlip: false };
      if (areTilesEqual(v, candidate)) return { index: i, hFlip: false, vFlip: true };
      if (areTilesEqual(hv, candidate)) return { index: i, hFlip: true, vFlip: true };
    }
    return null;
  };

  for (let mapY = 0; mapY < mapHeight; mapY++) {
    const row: MapCell[] = [];
    for (let mapX = 0; mapX < mapWidth; mapX++) {
      
      // Analyze 8x8 block
      const tileIndices: number[][] = [];
      const paletteCounts = [0, 0, 0, 0];
      
      // Pass 1: Collect indices and determine dominant palette
      for (let y = 0; y < 8; y++) {
        const rowIndices: number[] = [];
        for (let x = 0; x < 8; x++) {
          const imgX = mapX * 8 + x;
          const imgY = mapY * 8 + y;
          
          let idx = 0;
          if (imgX < ase.width && imgY < ase.height) {
            idx = ase.pixels[imgY * ase.width + imgX];
          }
          
          rowIndices.push(idx);
          
          if (idx !== 0) { // Ignore transparency for palette detection
             // Only consider first 64 colors valid
             const pIdx = Math.floor(idx / 16);
             if (pIdx >= 0 && pIdx < 4) {
                 paletteCounts[pIdx]++;
             }
          }
        }
        tileIndices.push(rowIndices);
      }
      
      // Determine winner palette
      let bestPalette = 0;
      let maxCount = -1;
      for (let p = 0; p < 4; p++) {
          if (paletteCounts[p] > maxCount) {
              maxCount = paletteCounts[p];
              bestPalette = p;
          }
      }
      
      // Pass 2: Normalize indices to 0-15 based on bestPalette
      const normalizedTile: TileData = [];
      for (let y = 0; y < 8; y++) {
        const normRow: number[] = [];
        for (let x = 0; x < 8; x++) {
          const globalIdx = tileIndices[y][x];
          let localIdx = 0;
          
          // If global index is 0 (transparent), keep 0.
          // If global index falls within the selected palette range, map it.
          // Otherwise, map to 0 (error handling)
          if (globalIdx !== 0) {
              const pIdx = Math.floor(globalIdx / 16);
              if (pIdx === bestPalette) {
                  localIdx = globalIdx % 16;
              } else {
                  localIdx = 0;
              }
          }
          normRow.push(localIdx);
        }
        normalizedTile.push(normRow);
      }
      
      // Deduplicate
      let tileIndex = -1;
      let hFlip = false;
      let vFlip = false;
      
      if (!forceUnique) {
        const existing = findExistingTile(normalizedTile);
        if (existing) {
            tileIndex = existing.index;
            hFlip = existing.hFlip;
            vFlip = existing.vFlip;
        }
      }
      
      if (tileIndex === -1) {
          tileIndex = newTiles.length;
          newTiles.push(normalizedTile);
      }
      
      row.push({
          tileIndex,
          paletteIndex: bestPalette,
          hFlip,
          vFlip,
          priority: false
      });
    }
    newMap.push(row);
  }

  return {
    palettes,
    tiles: newTiles,
    mapWidth,
    mapHeight,
    mapData: newMap
  };
};