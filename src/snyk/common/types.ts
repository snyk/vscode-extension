import { PJSON } from './constants/languageConsts';

export enum Language {
  PJSON,
}
export type OssRange = {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
};
export type ImportedModule = {
  fileName: string;
  name: string;
  line: number | null;
  loc: OssRange | null;
  string: string;
  version?: string;
};

export function languageToString(language: Language): string {
  switch (language) {
    case Language.PJSON:
      return PJSON;
  }
}

export type FeatureFlagStatus = {
  ok: boolean;
  userMessage?: string;
};
