import npmValidPackageName from 'validate-npm-package-name';
import { PJSON } from './constants/languageConsts';
import nativeModules from './constants/nativeModules';
import { ImportedModule, Language } from './types';

export function getSupportedLanguage(fileName: string, languageId: string): Language | null {
  if (languageId === PJSON && fileName.endsWith('package.json')) {
    return Language.PJSON;
  }

  return null;
}

export function isValidModuleName(module: ImportedModule): boolean {
  const moduleName = module.name;
  if (nativeModules.includes(moduleName.toLowerCase())) {
    return false;
  }

  if (moduleName.trim() == '' || /^[.~]/.test(moduleName)) {
    return false;
  }

  if (moduleName.includes('/') && !moduleName.startsWith('@')) {
    const newName = module.name.split('/').shift();
    if (newName) {
      // mutating…
      module.name = newName;
    } else {
      return false;
    }
  }

  const valid = npmValidPackageName(module.name);
  if (valid.errors) {
    // invalid package name, so isn't real, so we'll bail
    return false;
  }

  return true;
}
