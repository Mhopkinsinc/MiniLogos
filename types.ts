export enum PatcherMode {
  FullBanners = 'FULL BANNERS',
  MiniLogosOnly = 'MINI LOGOS ONLY'
}

export interface PatchOptions {
  enableTeamSelectBanners: boolean;
  enableInGameBanners: boolean;
  enablePlayoffBanners: boolean;
  enableMiniLogos: boolean;
  use32Teams: boolean;  // Experimental: Use 32 teams (only for MiniLogosOnly mode)
}

export interface PatchConfig {
  mode: PatcherMode;
  options: PatchOptions;
}

export interface RomFile {
  name: string;
  size: number;
  data: File;
}

/**
 * Represents a preset .jim file that has been overridden with custom data.
 * The key is the relative path within the wasm scripts folder (e.g., "minilogos/minilogos_32_teams.jim")
 */
export interface PresetOverride {
  /** The relative path of the preset file (e.g., "minilogos/minilogos_32_teams.jim") */
  presetPath: string;
  /** The binary .jim data to use instead of the default preset */
  jimData: Uint8Array;
  /** Optional: the original filename that was imported (for display purposes) */
  sourceName?: string;
}