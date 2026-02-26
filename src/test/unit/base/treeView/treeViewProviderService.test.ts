import sinon from 'sinon';
import { TreeViewProviderService } from '../../../../snyk/base/treeView/treeViewProviderService';
import { TreeViewWebviewProvider } from '../../../../snyk/common/views/treeViewWebviewProvider';
import { LoggerMock } from '../../mocks/logger.mock';

suite('TreeViewProviderService', () => {
  const logger = new LoggerMock();
  let updateWebviewContentStub: sinon.SinonStub;

  teardown(() => {
    sinon.restore();
  });

  test('updateTreeViewPanel forwards HTML to webview provider', () => {
    updateWebviewContentStub = sinon.stub();
    const mockProvider = {
      updateWebviewContent: updateWebviewContentStub,
    } as unknown as TreeViewWebviewProvider;

    const service = new TreeViewProviderService(logger, mockProvider);
    const html = '<html><body>test tree</body></html>';

    service.updateTreeViewPanel(html);

    sinon.assert.calledOnce(updateWebviewContentStub);
    sinon.assert.calledWith(updateWebviewContentStub, html);
  });

  test('updateTreeViewPanel logs error when provider is undefined', () => {
    const errorSpy = sinon.spy(logger, 'error');
    const service = new TreeViewProviderService(logger, undefined);

    service.updateTreeViewPanel('<html></html>');

    sinon.assert.calledOnce(errorSpy);
    errorSpy.restore();
  });

  test('updateTreeViewPanel catches provider errors', () => {
    const mockProvider = {
      updateWebviewContent: sinon.stub().throws(new Error('render failure')),
    } as unknown as TreeViewWebviewProvider;

    const errorSpy = sinon.spy(logger, 'error');
    const service = new TreeViewProviderService(logger, mockProvider);

    service.updateTreeViewPanel('<html></html>');

    sinon.assert.calledOnce(errorSpy);
    errorSpy.restore();
  });
});
