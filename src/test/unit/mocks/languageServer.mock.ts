import { ReplaySubject, Subject } from 'rxjs';
import sinon from 'sinon';
import { ILanguageServer } from '../../../snyk/common/languageServer/languageServer';
import {
  ShowIssueDetailTopicParams,
  CodeIssueData,
  IacIssueData,
  OssIssueData,
  Scan,
} from '../../../snyk/common/languageServer/types';

export class LanguageServerMock implements ILanguageServer {
  start = sinon.fake();
  stop = sinon.fake();
  showOutputChannel = sinon.fake();

  cliReady$ = new ReplaySubject<string>(1);
  scan$ = new Subject<Scan<CodeIssueData | OssIssueData | IacIssueData>>();
  showIssueDetailTopic$ = new Subject<ShowIssueDetailTopicParams>();
}
