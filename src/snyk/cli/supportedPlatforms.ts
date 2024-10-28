const SupportedCliPlatformsList = ['linux', 'linux_alpine', 'windows', 'macos', 'macos_arm64'] as const;
export type CliSupportedPlatform = typeof SupportedCliPlatformsList[number];
