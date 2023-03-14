import { IacIssueData, Scan, ScanProduct } from '../common/languageServer/types';
import { ProductService } from '../common/services/productService';

export class IacService extends ProductService<IacIssueData> {
  subscribeToLsScanMessages() {
    this.lsSubscription = this.languageServer.scan$.subscribe((scan: Scan<IacIssueData>) => {
      if (scan.product !== ScanProduct.InfrastructureAsCode) {
        return;
      }

      super.handleLsScanMessage(scan);
    });
  }

  refreshTreeView() {
    this.viewManagerService.refreshIacView();
  }
}
