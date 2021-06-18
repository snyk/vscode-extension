/**
 * This file is auto-generated by Iteratively.
 * To update run 'itly pull visual-studio-code'
 *
 * Works with versions ^2.0.8 of @itly/sdk and @itly/plugin's
 * https://www.npmjs.com/search?q=%40itly
 */

/* tslint:disable */
/* eslint-disable */
import {
  ItlyNode,
  Options as OptionsBase,
  Event as EventBase,
  Plugin,
  Environment as EnvironmentBase,
  Properties as PropertiesBase,
  ValidationResponse as ValidationResponseBase,
  CallOptions as CallOptionsBase,
  PluginCallOptions as PluginCallOptionsBase,
} from '@itly/sdk';
import SchemaValidatorPlugin from '@itly/plugin-schema-validator';
import IterativelyPlugin, { IterativelyOptionsPartial as IterativelyOptions } from '@itly/plugin-iteratively-node';

export type Options = OptionsBase;
export type Environment = EnvironmentBase;
export type Event = EventBase;
export type Properties = PropertiesBase;
export type ValidationResponse = ValidationResponseBase;
export type CallOptions = CallOptionsBase;
export type PluginCallOptions = PluginCallOptionsBase;
export { Plugin, Validation, Loggers } from '@itly/sdk';

export interface AliasOptions extends CallOptions {
}

export interface IdentifyOptions extends CallOptions {
}

export interface GroupOptions extends CallOptions {
}

export interface PageOptions extends CallOptions {
}

export interface TrackOptions extends CallOptions {
}

export interface IdentifyProperties {
  /**
   * Name of the user
   */
  name?: string;
  /**
   * query utm_medium
   */
  utmMedium?: string;
  /**
   * Link to access more information about the user
   */
  adminLink?: string;
  /**
   * Timestamp of user creation
   */
  createdAt?: number;
  /**
   * query utm_source
   */
  utmSource?: string;
  /**
   * Email address for the user
   */
  email?: string;
  /**
   * Auth provider (login method)
   */
  authProvider?: string;
  /**
   * Whether or not the user should be considered a Snyk administrator
   */
  isSnykAdmin?: boolean;
  /**
   * Username of the user
   */
  username?: string;
  /**
   * query utm_campaign
   */
  utmCampaign?: string;
}

export interface GroupProperties {
  /**
   * ID that is used in conjunction with a groupType to specify an Org or a Group association: {groupId: 1234, groupType: "org"}
   */
  groupId?: string;
  /**
   * The display name of the org
   */
  name?: string;
  /**
   * The internal name (org.name) of the org
   */
  internalName?: string;
  /**
   * Key that is used to specify the name of the Segment Group that a groupId is being set for.
   */
  groupType?: "org" | "group" | "account";
  /**
   * The plan of the org
   */
  plan?: string;
  /**
   * The name of the group associated with the org
   */
  groupName?: string;
}

export interface AnalysisIsReadyProperties {
  /**
   * Ide family.
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Visual Studio Code, Visual Studio, Eclipse, JetBrains |
   */
  ide: "Visual Studio Code" | "Visual Studio" | "Eclipse" | "JetBrains";
  /**
   * Analysis types selected by the user for the scan:
   *
   * * open source vulnerabilities
   *
   * * code quality issues
   *
   * * code security vulnerabilities
   *
   * * advisor issues
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Snyk Advisor, Snyk Code Quality, Snyk Code Security, Snyk Open Source |
   */
  analysisType: "Snyk Advisor" | "Snyk Code Quality" | "Snyk Code Security" | "Snyk Open Source";
  /**
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Success, Error |
   */
  result: "Success" | "Error";
}

export interface AnalysisIsTriggeredProperties {
  /**
   * Ide family.
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Visual Studio Code, Visual Studio, Eclipse, JetBrains |
   */
  ide: "Visual Studio Code" | "Visual Studio" | "Eclipse" | "JetBrains";
  /**
   * Analysis types selected by the user for the scan: open source vulnerabilities, code quality issues and/or code security vulnerabilities.
   *
   * | Rule | Value |
   * |---|---|
   * | Unique Items | true |
   * | Item Type | string |
   */
  analysisType: string[];
  /**
   * * True means that the analysis was triggered by the User.
   *
   * * False means that the analysis was triggered automatically by the plugin.
   */
  triggeredByUser: boolean;
}

export interface IssueIsViewedProperties {
  /**
   * Ide family.
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Visual Studio Code, Visual Studio, Eclipse, JetBrains |
   */
  ide: "Visual Studio Code" | "Visual Studio" | "Eclipse" | "JetBrains";
  /**
   * Issue type
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Open Source Vulnerability, Licence Issue, Code Quality Issue, Code Security Vulnerability, Advisor |
   */
  issueType:
    | "Open Source Vulnerability"
    | "Licence Issue"
    | "Code Quality Issue"
    | "Code Security Vulnerability"
    | "Advisor";
  /**
   * Severity of the issue
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | High, Medium, Low, Critical |
   */
  severity: "High" | "Medium" | "Low" | "Critical";
  /**
   * Issue ID as received from the backend.
   */
  issueId: string;
}

export interface PluginIsInstalledProperties {
  /**
   * Ide family.
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Visual Studio Code, Visual Studio, Eclipse, JetBrains |
   */
  ide: "Visual Studio Code" | "Visual Studio" | "Eclipse" | "JetBrains";
}

export interface PluginIsUninstalledProperties {
  /**
   * Ide family.
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Visual Studio Code, Visual Studio, Eclipse, JetBrains |
   */
  ide: "Visual Studio Code" | "Visual Studio" | "Eclipse" | "JetBrains";
}

export interface WelcomeIsViewedProperties {
  /**
   * Ide family.
   *
   * | Rule | Value |
   * |---|---|
   * | Enum Values | Visual Studio Code, Visual Studio, Eclipse, JetBrains |
   */
  ide: "Visual Studio Code" | "Visual Studio" | "Eclipse" | "JetBrains";
}

export class AnalysisIsReady implements Event {
  name = 'Analysis Is Ready';
  id = 'c9337edb-27a3-416e-a654-092fa4375feb';
  version = '10.0.0';
  properties: AnalysisIsReadyProperties & {
    'itly': true;
  };

  constructor(
    properties: AnalysisIsReadyProperties,
  ) {
    this.properties = {
        ...properties,
        'itly': true,
      };
  }
}

export class AnalysisIsTriggered implements Event {
  name = 'Analysis Is Triggered';
  id = 'dabf569e-219c-470f-8e31-6e029723f0cd';
  version = '7.0.0';
  properties: AnalysisIsTriggeredProperties & {
    'itly': true;
  };

  constructor(
    properties: AnalysisIsTriggeredProperties,
  ) {
    this.properties = {
        ...properties,
        'itly': true,
      };
  }
}

export class IssueIsViewed implements Event {
  name = 'Issue Is Viewed';
  id = 'bba9d69b-95d5-4082-80c3-4508402750bb';
  version = '5.0.0';
  properties: IssueIsViewedProperties & {
    'itly': true;
  };

  constructor(
    properties: IssueIsViewedProperties,
  ) {
    this.properties = {
        ...properties,
        'itly': true,
      };
  }
}

export class PluginIsInstalled implements Event {
  name = 'Plugin Is Installed';
  id = '7bb34693-366e-460e-8f4c-5b3f1c71888a';
  version = '4.0.0';
  properties: PluginIsInstalledProperties & {
    'itly': true;
  };

  constructor(
    properties: PluginIsInstalledProperties,
  ) {
    this.properties = {
        ...properties,
        'itly': true,
      };
  }
}

export class PluginIsUninstalled implements Event {
  name = 'Plugin Is Uninstalled';
  id = '5936cb0e-2639-4b76-baea-f0c086b860b0';
  version = '4.0.0';
  properties: PluginIsUninstalledProperties & {
    'itly': true;
  };

  constructor(
    properties: PluginIsUninstalledProperties,
  ) {
    this.properties = {
        ...properties,
        'itly': true,
      };
  }
}

export class WelcomeIsViewed implements Event {
  name = 'Welcome Is Viewed';
  id = '91114669-bbab-4f58-a7dd-ea7c98c79221';
  version = '4.0.0';
  properties: WelcomeIsViewedProperties & {
    'itly': true;
  };

  constructor(
    properties: WelcomeIsViewedProperties,
  ) {
    this.properties = {
        ...properties,
        'itly': true,
      };
  }
}

// prettier-ignore
interface DestinationOptions {
  iteratively?: IterativelyOptions;

  all?: {
    disabled?: boolean;
  };
}

export interface LoadOptions extends OptionsBase {
  /**
   * Analytics provider-specific configuration.
   */
  destinations?: DestinationOptions;
}

// prettier-ignore
class Itly {
  private itly: ItlyNode;

  constructor() {
    this.itly = new ItlyNode();
  }

  /**
   * Initialize the Itly SDK. Call once when your application starts.
   * @param loadOptions Configuration options to initialize the Itly SDK with.
   */
  load(loadOptions: LoadOptions = {}) {
    const {
      destinations = {} as DestinationOptions,
      plugins = [] as Plugin[],
      ...options
    } = loadOptions;

    const destinationPlugins = destinations.all && destinations.all.disabled
      ? []
      : [
        new IterativelyPlugin(options.environment === 'production'
          ? '5HB-hbvnCrU6EhiR-byG-pFwFAnceLbW'
          : 'nFVaJJwOdaJn9ETw_3DRSpFpg790tzEi',
          {
            url: 'https://api.iterative.ly/t/version/0e2a2281-a32f-4abd-8f0a-609b6e8902cc',
            environment: options.environment || 'development',
            ...destinations.iteratively,
          },
        ),
      ];

    this.itly.load({
      ...options,
      plugins: [
        new SchemaValidatorPlugin({
          'group': {"type":"object","properties":{"groupId":{"type":"string"},"name":{"type":"string"},"internalName":{"type":"string"},"groupType":{"enum":["org","group","account"]},"plan":{"type":"string"},"groupName":{"type":"string"}},"additionalProperties":false,"required":[]},
          'identify': {"type":"object","properties":{"name":{"type":"string"},"utmMedium":{"type":"string"},"adminLink":{"type":"string"},"createdAt":{"type":"number"},"utmSource":{"type":"string"},"email":{"type":"string"},"authProvider":{"type":"string"},"isSnykAdmin":{"type":"boolean"},"username":{"type":"string"},"utmCampaign":{"type":"string"}},"additionalProperties":false,"required":[]},
          'Analysis Is Ready': {"type":"object","properties":{"ide":{"enum":["Visual Studio Code","Visual Studio","Eclipse","JetBrains"]},"itly":{"const":true},"analysisType":{"enum":["Snyk Advisor","Snyk Code Quality","Snyk Code Security","Snyk Open Source"]},"result":{"enum":["Success","Error"]}},"additionalProperties":false,"required":["ide","itly","analysisType","result"]},
          'Analysis Is Triggered': {"type":"object","properties":{"ide":{"enum":["Visual Studio Code","Visual Studio","Eclipse","JetBrains"]},"itly":{"const":true},"analysisType":{"type":"array","items":{"type":"string"},"uniqueItems":true},"triggeredByUser":{"type":"boolean"}},"additionalProperties":false,"required":["ide","itly","analysisType","triggeredByUser"]},
          'Issue Is Viewed': {"type":"object","properties":{"ide":{"enum":["Visual Studio Code","Visual Studio","Eclipse","JetBrains"]},"issueType":{"enum":["Open Source Vulnerability","Licence Issue","Code Quality Issue","Code Security Vulnerability","Advisor"]},"severity":{"enum":["High","Medium","Low","Critical"]},"issueId":{"type":"string"},"itly":{"const":true}},"additionalProperties":false,"required":["ide","issueType","severity","issueId","itly"]},
          'Plugin Is Installed': {"type":"object","properties":{"ide":{"enum":["Visual Studio Code","Visual Studio","Eclipse","JetBrains"]},"itly":{"const":true}},"additionalProperties":false,"required":["ide","itly"]},
          'Plugin Is Uninstalled': {"type":"object","properties":{"ide":{"enum":["Visual Studio Code","Visual Studio","Eclipse","JetBrains"]},"itly":{"const":true}},"additionalProperties":false,"required":["ide","itly"]},
          'Welcome Is Viewed': {"type":"object","properties":{"ide":{"enum":["Visual Studio Code","Visual Studio","Eclipse","JetBrains"]},"itly":{"const":true}},"additionalProperties":false,"required":["ide","itly"]},
        }),
        ...destinationPlugins,
        ...plugins,
      ],
    });
  }

  /**
   * Alias a user ID to another user ID.
   * @param userId The user's new ID.
   * @param previousId The user's previous ID.
   * @param options Options for this alias call.
   */
  alias(userId: string, previousId: string, options?: AliasOptions) {
    this.itly.alias(userId, previousId, options);
  }

  /**
   * Identify a user and set or update that user's properties.
   * @param userId The user's ID.
   * @param properties The user's properties.
   * @param options Options for this identify call.
   */
  identify(
    userId: string,
    properties?: IdentifyProperties,
    options?: IdentifyOptions,
  ) {
    this.itly.identify(userId, properties, options)
  }

  /**
   * Associate a user with a group and set or update that group's properties.
   * @param userId The user's ID.
   * @param groupId The group's ID.
   * @param properties The group's properties.
   * @param options Options for this group call.
   */
  group(
    userId: string,
    groupId: string,
    properties?: GroupProperties,
    options?: GroupOptions,
  ) {
    this.itly.group(userId, groupId, properties, options)
  }

  /**
   * Triggered when the analysis is loaded within the IDE.
   * 
   * Owner: Georgi 
   * @param userId The user's ID.
   * @param properties The event's properties (e.g. ide)
   * @param options Options for this track call.
   */
  analysisIsReady(
    userId: string,
    properties: AnalysisIsReadyProperties,
    options?: TrackOptions,
  ) {
    this.itly.track(userId, new AnalysisIsReady(properties), options);
  }

  /**
   * User triggers an analysis or analysis is automatically triggered.
   * 
   * Owner: Georgi 
   * @param userId The user's ID.
   * @param properties The event's properties (e.g. ide)
   * @param options Options for this track call.
   */
  analysisIsTriggered(
    userId: string,
    properties: AnalysisIsTriggeredProperties,
    options?: TrackOptions,
  ) {
    this.itly.track(userId, new AnalysisIsTriggered(properties), options);
  }

  /**
   * Triggered when the user selects an issue from the issues list and the issue is loaded.
   * 
   * Owner: Georgi 
   * @param userId The user's ID.
   * @param properties The event's properties (e.g. ide)
   * @param options Options for this track call.
   */
  issueIsViewed(
    userId: string,
    properties: IssueIsViewedProperties,
    options?: TrackOptions,
  ) {
    this.itly.track(userId, new IssueIsViewed(properties), options);
  }

  /**
   * Triggered when the user installs the plugin.
   * 
   * Owner: Georgi 
   * @param userId The user's ID.
   * @param properties The event's properties (e.g. ide)
   * @param options Options for this track call.
   */
  pluginIsInstalled(
    userId: string,
    properties: PluginIsInstalledProperties,
    options?: TrackOptions,
  ) {
    this.itly.track(userId, new PluginIsInstalled(properties), options);
  }

  /**
   * Triggered when the user uninstalls the plugin.
   * 
   * Owner: Georgi 
   * @param userId The user's ID.
   * @param properties The event's properties (e.g. ide)
   * @param options Options for this track call.
   */
  pluginIsUninstalled(
    userId: string,
    properties: PluginIsUninstalledProperties,
    options?: TrackOptions,
  ) {
    this.itly.track(userId, new PluginIsUninstalled(properties), options);
  }

  /**
   * User installs the IDE plugin and see Snyk's welcome screen.
   * 
   * Owner: Georgi 
   * @param userId The user's ID.
   * @param properties The event's properties (e.g. ide)
   * @param options Options for this track call.
   */
  welcomeIsViewed(
    userId: string,
    properties: WelcomeIsViewedProperties,
    options?: TrackOptions,
  ) {
    this.itly.track(userId, new WelcomeIsViewed(properties), options);
  }

  /**
   * Track any event.
   * @param userId The user's ID.
   * @param event The event to track.
   * @param options Options for this track call.
   */
  track(userId: string, event: Event, options?: TrackOptions) {
    this.itly.track(userId, event, options);
  }

  // reset() N/A for Node.js

  async flush() {
    await this.itly.flush();
  }
}

export default new Itly();
