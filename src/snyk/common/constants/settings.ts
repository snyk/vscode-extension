// VS Code configuration settings
// Ensure consistency with package.json when changing these constants
export const CONFIGURATION_IDENTIFIER = 'snyk';

export const TOKEN_SETTING = `${CONFIGURATION_IDENTIFIER}.token`;

export const OSS_ENABLED_SETTING = `${CONFIGURATION_IDENTIFIER}.features.openSourceSecurity`;
export const CODE_SECURITY_ENABLED_SETTING = `${CONFIGURATION_IDENTIFIER}.features.codeSecurity`;
export const CODE_QUALITY_ENABLED_SETTING = `${CONFIGURATION_IDENTIFIER}.features.codeQuality`;

export const YES_CRASH_REPORT_SETTING = `${CONFIGURATION_IDENTIFIER}.yesCrashReport`;
export const YES_TELEMETRY_SETTING = `${CONFIGURATION_IDENTIFIER}.yesTelemetry`;
export const YES_WELCOME_NOTIFICATION_SETTING = `${CONFIGURATION_IDENTIFIER}.yesWelcomeNotification`;
export const YES_BACKGROUND_OSS_NOTIFICATION_SETTING = `${CONFIGURATION_IDENTIFIER}.yesBackgroundOssNotification`;

export const ADVANCED_ADVANCED_MODE_SETTING = `${CONFIGURATION_IDENTIFIER}.advanced.advancedMode`;
export const ADVANCED_AUTOSCAN_OSS_SETTING = `${CONFIGURATION_IDENTIFIER}.advanced.autoScanOpenSourceSecurity`;
export const ADVANCED_ADDITIONAL_PARAMETERS_SETTING = `${CONFIGURATION_IDENTIFIER}.advanced.additionalParameters`;

export const SEVERITY_FILTER_SETTING = `${CONFIGURATION_IDENTIFIER}.severity`;
