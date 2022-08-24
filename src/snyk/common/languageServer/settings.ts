export type InitializationOptions = ServerSettings & {
  integrationName?: string;
  integrationVersion?: string;
};

export type ServerSettings = {
  activateSnykCode?: string;
  activateSnykOpenSource?: string;
  activateSnykIac?: string;
  endpoint?: string;
  additionalParams?: string;
  path?: string;
  sendErrorReports?: string;
  organization?: string;
  enableTelemetry?: string;
  manageBinariesAutomatically?: string;
  cliPath?: string;
  token?: string;
};

export type ClientSettings = {
  yesCrashReport: boolean;
  yesTelemetry: boolean;
  yesWelcomeNotification: boolean;
  yesBackgroundOssNotification: boolean;
  advanced: AdvancedSettings;
  features: FeaturesSettings;
  severity: SeveritySettings;
};

export type AdvancedSettings = {
  advancedMode: boolean;
  autoScanOpenSourceSecurity: boolean;
  additionalParameters: string;
  customEndpoint: string;
  organization: string;
  tokenStorage: string;
  automaticDependencyManagement: boolean;
  cliPath: string;
};

export type FeaturesSettings = {
  openSourceSecurity: boolean;
  codeSecurity: boolean;
  codeQuality: boolean;
  preview: Preview;
};

export type Preview = {
  reportFalsePositives: boolean;
  lsAuthenticate: boolean;
};

export type SeveritySettings = {
  critical: boolean;
  high: boolean;
  medium: boolean;
  low: boolean;
};
