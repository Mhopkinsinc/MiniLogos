export enum PatcherMode {
  FullBanners = 'FULL BANNERS',
  MiniLogosOnly = 'MINI LOGOS ONLY'
}

export interface PatchOptions {
  enableTeamSelectBanners: boolean;
  enableInGameBanners: boolean;
  enablePlayoffBanners: boolean;
  enableMiniLogos: boolean;
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