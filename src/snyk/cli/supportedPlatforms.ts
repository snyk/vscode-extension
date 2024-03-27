const SupportedCliPlatformsList = ['linux', 'win32', 'darwin'] as const;
export type CliSupportedPlatform = typeof SupportedCliPlatformsList[number];
