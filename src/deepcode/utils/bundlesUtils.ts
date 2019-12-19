import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { FILE_CURRENT_STATUS } from "../constants/filesConstants";

export const checkIfBundleIsEmpty = (
  bundlesBatch:
    | DeepCode.HashesBundlesInterface
    | DeepCode.RemoteBundlesCollectionInterface,
  bundlePath?: string
): boolean =>
  !Object.keys(bundlePath ? bundlesBatch[bundlePath] || {} : bundlesBatch).length;

export const extendLocalHashBundle = (
  updatedFiles: Array<{
    [key: string]: string;
  }>,
  currentHashBundle: DeepCode.BundlesInterface
): DeepCode.BundlesInterface => {
  const modifiedHashBundle: DeepCode.BundlesInterface = {
    ...currentHashBundle
  };
  for (const updatedFile of updatedFiles) {
    if (
      updatedFile.status === FILE_CURRENT_STATUS.deleted &&
      modifiedHashBundle[updatedFile.filePath]
    ) {
      delete modifiedHashBundle[updatedFile.filePath];
    }
    if (
      updatedFile.status === FILE_CURRENT_STATUS.modified ||
      updatedFile.status === FILE_CURRENT_STATUS.created
    ) {
      modifiedHashBundle[updatedFile.filePath] = updatedFile.fileHash;
    }
  }
  return modifiedHashBundle;
};
