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