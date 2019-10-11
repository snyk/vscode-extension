import DeepCode from "../../interfaces/DeepCodeInterfaces";

export const checkIfBundleIsEmpty = (
  bundlesBatch:
    | DeepCode.HashesBundlesInterface
    | DeepCode.RemoteBundlesCollectionInterface,
  bundlePath?: string
): boolean =>
  !Object.keys(bundlePath ? bundlesBatch[bundlePath] : bundlesBatch).length;
