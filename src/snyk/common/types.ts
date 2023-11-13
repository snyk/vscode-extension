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
      return 'TypeScript';
    case Language.JavaScript:
      return 'JavaScript';
    case Language.HTML:
      return 'HTML';
    case Language.PJSON:
      return 'Package.json';
    default:
      return 'Unknown';
  }
}
