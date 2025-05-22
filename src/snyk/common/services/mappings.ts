import { LsScanProduct, ScanProduct } from '../languageServer/types';

export function productToLsProduct(product: ScanProduct): LsScanProduct {
  switch (product) {
    case ScanProduct.Code:
      return LsScanProduct.Code;
    case ScanProduct.InfrastructureAsCode:
      return LsScanProduct.InfrastructureAsCode;
    case ScanProduct.OpenSource:
      return LsScanProduct.OpenSource;
    default:
      return LsScanProduct.Unknown;
  }
}
