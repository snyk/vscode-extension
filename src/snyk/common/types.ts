import { JAVASCRIPT, TYPESCRIPT, HTML, PJSON } from './constants/languageConsts';

export enum Language {
  TypeScript,
  JavaScript,
  HTML,
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
    case Language.TypeScript:
      return TYPESCRIPT;
    case Language.JavaScript:
      return JAVASCRIPT;
    case Language.HTML:
      return HTML;
    case Language.PJSON:
      return PJSON;
  }
}

export type FeatureFlagStatus = {
  ok: boolean;
  userMessage?: string;
};
