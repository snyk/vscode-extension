import { strictEqual } from 'assert';
import { configuration } from '../../snyk/configuration';
import { getExtension } from '../../extension';
import { SNYK_VIEW_FEATURES, SNYK_VIEW_WELCOME } from '../../snyk/constants/views';
import { TreeView } from 'vscode';
import { FeaturesViewProvider } from '../../snyk/view/welcome/welcomeViewProvider';
import { TreeNode } from '../../snyk/view/treeNode';

suite('View Navigation', () => {
  setup(async () => {
    await configuration.setToken(undefined);
    await configuration.setFeaturesConfiguration(undefined);
  });

  teardown(async () => {
    await configuration.setToken(undefined);
  });

  test('"Feature view is seen after user authenticates within welcome view', async () => {
    const extension = getExtension();
    const viewContainer = extension.viewManagerService.viewContainer;
    const welcomeTree = viewContainer.get<TreeView<TreeNode>>(SNYK_VIEW_WELCOME);

    // 1. Check welcome view is visible
    strictEqual(welcomeTree?.visible, true);

    // 2. Authenticate a user
    await configuration.setToken('fake-token');

    // Give time to pick up the setting change
    const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
    await sleep(1500);

    // 3. Assert
    const featuresView = viewContainer.get<FeaturesViewProvider>(SNYK_VIEW_FEATURES);
    strictEqual(featuresView?.getWebView()?.visible, true);
  });
});
