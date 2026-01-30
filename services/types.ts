export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type Palette = RgbColor[];

export type TilePixelRow = number[]; // Array of 8 color indices
export type TileData = TilePixelRow[]; // Array of 8 rows

export interface MapCell {
  tileIndex: number;
  paletteIndex: number;
  hFlip: boolean;
  vFlip: boolean;
  priority: boolean;
}

export interface JimData {
  palettes: Palette[]; // 4 palettes of 16 colors
  tiles: TileData[];
  mapWidth: number;
  mapHeight: number;
  mapData: MapCell[][]; // [y][x]
}

export interface JimMetadata {
  map_width: number;
  map_height: number;
  num_tiles: number;
  palettes: [number, number, number][][]; // Simple tuple array for JSON export
  cells: {
    tile: number;
    palette: number;
    hflip: number;
    vflip: number;
    priority: number;
  }[][];
}