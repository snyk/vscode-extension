export const SupportedLsPlatformsList = [
  'darwinAmd64',
  'darwinArm64',
  'linux386',
  'linuxAmd64',
  'linuxArm64',
  'windows386',
  'windowsAmd64',
] as const;

export function isPlatformSupported(platform: string): boolean {
  if (SupportedLsPlatformsList.find(p => p === platform) !== undefined) {
    return true;
  }

  return false;
}

export type LsSupportedPlatform = typeof SupportedLsPlatformsList[number];
