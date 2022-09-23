export const SupportedCliPlatformsList = ['linux', 'win32', 'darwin'] as const;
export type CliSupportedPlatform = typeof SupportedCliPlatformsList[number];

export function isPlatformSupported(platform: NodeJS.Platform): boolean {
  return SupportedCliPlatformsList.find(p => p === platform) !== undefined;
}
