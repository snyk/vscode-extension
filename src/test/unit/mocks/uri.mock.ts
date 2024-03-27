import { Uri } from '../../../snyk/common/vscode/types';
import { IUriAdapter } from '../../../snyk/common/vscode/uri';

class UriAdapterMock implements IUriAdapter {
  file(path: string): Uri {
    return {
      path: path,
    } as Uri;
  }

  parse(path: string): Uri {
    return {
      path: path,
    } as Uri;
  }
}
