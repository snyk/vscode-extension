import { Issue, OssIssueData } from '../../common/languageServer/types';
import { IWebViewProvider } from '../../common/views/webviewProvider';
import { OssVulnerability } from '../ossResult';

export interface IOssSuggestionWebviewProvider extends IWebViewProvider<Issue<OssIssueData>> {
  openIssueId: string | undefined;
}

export type OssIssueCommandArg = OssVulnerability & {
  matchingIdVulnerabilities: OssVulnerability[];
  overviewHtml: string;
};
