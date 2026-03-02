/**
 * ROM Free Space Scanner Service
 * Detects trailing padding (0xFF bytes) at the end of ROM files
 * to determine available free space.
 */

export interface FreeSpaceInfo {
  /** Total ROM size in bytes */
  romLength: number;
  /** Starting address of free space (first 0xFF byte in trailing padding) */
  freeSpaceStart: number;
  /** Size of free space in bytes */
  freeSpaceSize: number;
  /** Index of last non-0xFF byte */
  lastDataIndex: number;
  /** Free space as percentage of total ROM */
  freeSpacePercent: number;
}

/**
 * Scans a ROM buffer to detect trailing free space (0xFF padding).
 * Walks the ROM buffer from the last address downwards until finding a byte != 0xFF.
 * Free space begins at index + 1, and size is romLength - (index + 1).
 * 
 * @param romBuffer - The ROM data as a Uint8Array
 * @returns FreeSpaceInfo object with details about free space
 */
export function scanRomFreeSpace(romBuffer: Uint8Array): FreeSpaceInfo {
  const romLength = romBuffer.length;
  
  // Walk backwards from the end to find the last non-0xFF byte
  let lastDataIndex = romLength - 1;
  while (lastDataIndex >= 0 && romBuffer[lastDataIndex] === 0xFF) {
    lastDataIndex--;
  }
  
  // Free space starts at the index after the last data byte
  const freeSpaceStart = lastDataIndex + 1;
  const freeSpaceSize = romLength - freeSpaceStart;
  const freeSpacePercent = romLength > 0 
    ? (freeSpaceSize / romLength) * 100 
    : 0;
  
  return {
    romLength,
    freeSpaceStart,
    freeSpaceSize,
    lastDataIndex,
    freeSpacePercent
  };
}

/**
 * Formats a byte size into a human-readable string (KB, MB, etc.)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats an address in hexadecimal notation
 */
export function formatHexAddress(address: number): string {
  return `0x${address.toString(16).toUpperCase().padStart(6, '0')}`;
}

/**
 * Scans a ROM File object for free space.
 * Reads the File data and returns free space information.
 * 
 * @param file - The ROM File object
 * @returns Promise resolving to FreeSpaceInfo
 */
export async function scanRomFileFreeSpace(file: File): Promise<FreeSpaceInfo> {
  const arrayBuffer = await file.arrayBuffer();
  const romBuffer = new Uint8Array(arrayBuffer);
  return scanRomFreeSpace(romBuffer);
}
