import { IExplicitOverridesMap } from '../../../snyk/common/languageServer/explicitOverridesMap';
import { ILastKnownValueCache } from '../../../snyk/common/languageServer/lastKnownValueCache';

// explicitOverridesMap/lastKnownValueCache are required constructor
// params. This no-op pair stands in for tests that don't exercise explicit-overrides behavior.
export const noopExplicitOverridesMap: IExplicitOverridesMap = {
  setExplicitValue: () => undefined,
  setReset: () => undefined,
  getEntry: () => undefined,
  confirmResetDelivered: () => undefined,
};

export const noopLastKnownValueCache: ILastKnownValueCache = {
  get: () => undefined,
  set: () => undefined,
};
