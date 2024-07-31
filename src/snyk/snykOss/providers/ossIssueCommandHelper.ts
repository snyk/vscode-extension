import { marked } from 'marked';
import { Issue, OssIssueData } from '../../common/languageServer/types';
import { OssIssueCommandArg } from '../interfaces';

export function getOssIssueCommandArg(
  vuln: Issue<OssIssueData>,
  folderPath: string,
  filteredVulns: Issue<OssIssueData>[],
): OssIssueCommandArg {
  const matchingIdVulnerabilities = filteredVulns.filter(v => v.id === vuln.id);
  let overviewHtml = '';

  try {
    // TODO: marked.parse does not sanitize the HTML. See: https://marked.js.org/#usage
    overviewHtml = marked.parse(vuln.additionalData.description) as string;
  } catch (error) {
    overviewHtml = '<p>There was a problem rendering the issue overview</p>';
  }

  return {
    ...vuln,
    matchingIdVulnerabilities,
    overviewHtml,
    folderPath,
  };
}
