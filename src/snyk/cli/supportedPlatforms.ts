const SupportedCliPlatformsList = [
  'linux',
  'linux_arm64',
  'linux_alpine',
  'linux_alpine_arm64',
  'windows',
  'windows_arm64',
  'macos',
  'macos_arm64',
] as const;
export type CliSupportedPlatform = typeof SupportedCliPlatformsList[number];
