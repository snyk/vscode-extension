export const SupportedPlatformsList = ['linux', 'win32', 'darwin'] as const;
export type SupportedPlatform = typeof SupportedPlatformsList[number];

export function isPlatformSupported(platform: NodeJS.Platform): boolean {
  if (SupportedPlatformsList.find(p => p === platform) !== undefined) {
    return true;
  }

  return false;
}
