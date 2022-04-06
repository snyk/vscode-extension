import sinon from 'sinon';
import { AdvisorRegistry } from '../../../../snyk/advisor/advisorTypes';
import { IAdvisorApiClient } from '../../../../snyk/advisor/services/advisorApiClient';
import { PJSON } from '../../../../snyk/common/constants/languageConsts';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { TextEditor } from '../../../../snyk/common/vscode/types';
import { IVSCodeWindow } from '../../../../snyk/common/vscode/window';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';

const postFake = sinon.stub().returns({
  data: [],
});
const scoresStub = sinon.stub().resolves({ data: [] });
const advisorApiClientStub: IAdvisorApiClient = {
  post: postFake,
  apiPath: '',
  getAdvisorUrl: function (registry: AdvisorRegistry): string {
    return `${registry}/scores`;
  },
};

const advisorStubWorkspace: IVSCodeWorkspace = {} as IVSCodeWorkspace;
const advisorStubWindow: IVSCodeWindow = {
  createTextEditorDecorationType: sinon.fake(),
  getActiveTextEditor: sinon.fake.returns({
    document: {
      fileName: 'C:\\git\\project\\package.json',
      languageId: PJSON,
      getText: () => '',
    },
  } as TextEditor),
  getVisibleTextEditors: sinon.fake.returns([]),
} as unknown as IVSCodeWindow;
const advisorStubLanguages: IVSCodeLanguages = {
  createDiagnosticCollection: sinon.fake(),
  registerCodeActionsProvider: sinon.fake(),
  registerHoverProvider: sinon.fake(),
} as unknown as IVSCodeLanguages;

export { scoresStub, postFake, advisorApiClientStub, advisorStubWorkspace, advisorStubLanguages, advisorStubWindow };
