import { TreeNode } from './treeNode';
import { TreeNodeProvider } from './treeNodeProvider';

/*
  Provides an empty tree data for views with welcome content ("viewsWelcome" in package.json) because they are tree views by default.

  This allows attaching event listeners to such views.
*/
export class EmptyTreeDataProvider extends TreeNodeProvider {
  getRootChildren(): TreeNode[] {
    return [];
  }
}
