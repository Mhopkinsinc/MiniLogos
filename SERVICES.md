# JimEdit Services Module Documentation

This module provides a complete suite of tools for manipulating Sega Genesis `.jim` map files (specifically used in NHL Hockey '92) and integrating with Aseprite workflows. It is designed to be a self-contained library.

## Integration

To use this in another TypeScript application, simply copy the entire `services/` directory into your project.

```typescript
import { 
  parseJimFile, 
  createJimFile, 
  JimData, 
  renderMapToCanvas 
} from './services';
```

## Core Data Structures

The primary data structure is `JimData`. All manipulations should operate on this object.

### `JimData`
Represents the complete state of a map file.
```typescript
interface JimData {
  palettes: Palette[];     // Array of 4 Palettes. Each Palette is RgbColor[16].
  tiles: TileData[];       // Array of 8x8 pixel tiles.
  mapWidth: number;        // Map width in tiles.
  mapHeight: number;       // Map height in tiles.
  mapData: MapCell[][];    // 2D Array [y][x] of cells.
}
```

### `MapCell`
Represents a single grid unit on the map.
```typescript
interface MapCell {
  tileIndex: number;    // Index into the 'tiles' array (0-2047).
  paletteIndex: number; // 0-3. Which palette to use for this cell.
  hFlip: boolean;       // Horizontal Flip.
  vFlip: boolean;       // Vertical Flip.
  priority: boolean;    // Sprite priority flag (draw over sprites).
}
```

### `TileData`
A raw 8x8 grid of color indices (0-15).
```typescript
type TilePixelRow = number[]; // Array of 8 integers (0-15)
type TileData = TilePixelRow[]; // Array of 8 rows
```

---

## API Reference

### 1. File Parsing

#### `parseJimFile(buffer: ArrayBuffer): JimData`
Parses a binary `.jim` file into the `JimData` structure.
*   **buffer**: The raw file buffer.
*   **Returns**: `JimData` object.

#### `parseAseprite(buffer: ArrayBuffer): Promise<AsepriteData>`
Parses a `.ase` or `.aseprite` file. This is an intermediate step before converting to `JimData`.
*   **buffer**: The raw file buffer.
*   **Returns**: `AsepriteData` containing raw pixels and palette.

#### `convertAsepriteToJim(ase: AsepriteData, forceUnique: boolean): JimData`
Converts raw Aseprite data into the Genesis-compatible `JimData` format.
*   **ase**: The data returned from `parseAseprite`.
*   **forceUnique**: If `true`, disables tile deduplication (every 8x8 block becomes a new tile). If `false`, optimizes by reusing identical tiles (including flipped versions).
*   **Returns**: `JimData`.

### 2. File Generation

#### `createJimFile(jim: JimData): Uint8Array`
Serializes `JimData` back into the binary `.jim` format suitable for the Sega Genesis game.
*   **jim**: The data object.
*   **Returns**: Uint8Array containing the binary file.

#### `createAsepriteBlob(jim: JimData, mode: 'map' | 'tileset', activePaletteIdx: number, transparentBg: boolean): Promise<Blob>`
Exports the current data as an editable Aseprite file.
*   **mode**:
    *   `'map'`: Exports the full map layout.
    *   `'tileset'`: Exports just the unique tiles in a grid.
*   **activePaletteIdx**:
    *   `0-3`: Forces the export to use a specific 16-color palette.
    *   `-1` (Map Mode Only): "Native" mode. Uses a flattened 64-color palette to represent all 4 palettes simultaneously.
*   **Returns**: A `Blob` representing the `.aseprite` file.

### 3. Rendering

#### `renderMapToCanvas(jim: JimData, canvas: HTMLCanvasElement, forcePaletteIndex?: number, transparentBg?: boolean): void`
Renders the full map to an HTML Canvas.
*   **forcePaletteIndex**: If provided (>=0), overrides individual cell palette choices and renders everything with the specific palette.
*   **transparentBg**: If true, color index 0 is rendered transparent.

#### `renderTilesetToCanvas(jim: JimData, canvas: HTMLCanvasElement, paletteIndex: number, spacing: number, transparentBg: boolean): void`
Renders the raw tileset (stamps) to a canvas.
*   **spacing**: Pixel gap between tiles (useful for grid visualization).

### 4. Modification / Updates

#### `updateJimFromImage(originalJim: JimData, imageData: ImageData): JimData`
Updates the map layout and tileset based on an edited image (PNG import).
*   **Logic**:
    1.  Breaks the image into 8x8 blocks.
    2.  Matches block colors to the *existing* palettes in `originalJim`.
    3.  Finds or creates tiles to match the pixel data.
    4.  Updates `mapData` to point to these tiles.
    5.  Preserves the original palettes (does not generate new palettes).
*   **Usage**: Use this to allow users to draw on the map in an external editor and import the changes back.

---

## Example Workflows

### A. Loading and Viewing a Map
```typescript
const response = await fetch('map.jim');
const buffer = await response.arrayBuffer();
const jimData = parseJimFile(buffer);

const canvas = document.getElementById('myCanvas');
renderMapToCanvas(jimData, canvas);
```

### B. Converting Aseprite to Jim
```typescript
// 1. Parse Aseprite
const buffer = await file.arrayBuffer();
const aseData = await parseAseprite(buffer);

// 2. Convert to Genesis format (with deduplication)
const jimData = convertAsepriteToJim(aseData, false);

// 3. Save as Jim
const binary = createJimFile(jimData);
```

### C. Updating via PNG
This allows "Round-Trip" editing: Export PNG -> Edit in Photoshop -> Import PNG.

```typescript
// Assume 'currentJim' exists
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// ... draw image onto context ...
const imageData = ctx.getImageData(0, 0, width, height);

// Recalculate tiles based on the image
const updatedJim = updateJimFromImage(currentJim, imageData);
```

### D. Exporting to PNG
To export the map, tileset, or palettes as an image, render to a canvas and use standard browser APIs.

```typescript
// 1. Create a canvas (can be off-screen)
const canvas = document.createElement('canvas');

// 2. Render content
// Example: Render Map
renderMapToCanvas(jimData, canvas);
// Example: Render Tileset (Palette 0, 1px spacing)
// renderTilesetToCanvas(jimData, canvas, 0, 1, true);

// 3. Convert to Data URL or Blob
const dataUrl = canvas.toDataURL('image/png');

// 4. Trigger Download (Browser)
const link = document.createElement('a');
link.href = dataUrl;
link.download = 'map.png';
link.click();
```
