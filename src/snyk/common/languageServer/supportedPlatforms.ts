export const SupportedLsPlatformsList = [
  'darwinAmd64',
  'darwinArm64',
  'linux386',
  'linuxAmd64',
  'linuxArm64',
  'windows386',
  'windowsAmd64',
] as const;

export type LsSupportedPlatform = typeof SupportedLsPlatformsList[number];
