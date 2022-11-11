// VS Code configuration settings
// Ensure consistency with package.json when changing these constants
export const CONFIGURATION_IDENTIFIER = 'snyk';

export const OSS_ENABLED_SETTING = `${CONFIGURATION_IDENTIFIER}.features.openSourceSecurity`;
export const CODE_SECURITY_ENABLED_SETTING = `${CONFIGURATION_IDENTIFIER}.features.codeSecurity`;
export const CODE_QUALITY_ENABLED_SETTING = `${CONFIGURATION_IDENTIFIER}.features.codeQuality`;
export const IAC_ENABLED_SETTING = `${CONFIGURATION_IDENTIFIER}.features.infrastructureAsCode`;
export const FEATURES_PREVIEW_SETTING = `${CONFIGURATION_IDENTIFIER}.features.preview`;

export const YES_CRASH_REPORT_SETTING = `${CONFIGURATION_IDENTIFIER}.yesCrashReport`;
export const YES_TELEMETRY_SETTING = `${CONFIGURATION_IDENTIFIER}.yesTelemetry`;
export const YES_WELCOME_NOTIFICATION_SETTING = `${CONFIGURATION_IDENTIFIER}.yesWelcomeNotification`;
export const YES_BACKGROUND_OSS_NOTIFICATION_SETTING = `${CONFIGURATION_IDENTIFIER}.yesBackgroundOssNotification`;

export const ADVANCED_ADVANCED_MODE_SETTING = `${CONFIGURATION_IDENTIFIER}.advanced.advancedMode`;
export const ADVANCED_AUTOSCAN_OSS_SETTING = `${CONFIGURATION_IDENTIFIER}.advanced.autoScanOpenSourceSecurity`;
export const ADVANCED_ADDITIONAL_PARAMETERS_SETTING = `${CONFIGURATION_IDENTIFIER}.advanced.additionalParameters`;
export const ADVANCED_CUSTOM_ENDPOINT = `${CONFIGURATION_IDENTIFIER}.advanced.customEndpoint`;
export const ADVANCED_ORGANIZATION = `${CONFIGURATION_IDENTIFIER}.advanced.organization`;
export const ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT = `${CONFIGURATION_IDENTIFIER}.advanced.automaticDependencyManagement`;
export const ADVANCED_CLI_PATH = `${CONFIGURATION_IDENTIFIER}.advanced.cliPath`;
export const ADVANCED_CUSTOM_LS_PATH = `${CONFIGURATION_IDENTIFIER}.advanced.languageServerPath`;

export const SEVERITY_FILTER_SETTING = `${CONFIGURATION_IDENTIFIER}.severity`;
export const TRUSTED_FOLDERS = `${CONFIGURATION_IDENTIFIER}.trustedFolders`;
