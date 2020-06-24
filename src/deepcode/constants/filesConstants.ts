export const HASH_ALGORITHM = "sha256";
export const ENCODE_TYPE = "hex";
export const FILE_FORMAT = "utf-8";
export const GIT_FILENAME = ".git";
export const GITIGNORE_FILENAME = ".gitignore";
export const DCIGNORE_FILENAME = ".dcignore";
export const EXCLUDED_NAMES = [
  GIT_FILENAME,
  GITIGNORE_FILENAME,
  DCIGNORE_FILENAME,
  ".vscode/"
];

export const FILE_CURRENT_STATUS = {
  modified: "modified",
  deleted: "deleted",
  same: "same",
  created: "created"
};

export const SUPPORTED_WATCH_FILES = ['*.jsx', '*.es6', '*.vue', '*.hpp', '*.html', '*.htm', '*.tsx', '*.cxx', '*.es', '*.ts', '*.c', '*.cc', '*.hxx', '*.py', '*.java', '*.h', '*.cpp', '*.js', '.pylintrc', 'tslint.json', '.eslintrc.yml', '.pmdrc.xml', '.ruleset.xml', '.eslintrc.js', '.eslintrc.json', 'ruleset.xml', 'pylintrc'];
