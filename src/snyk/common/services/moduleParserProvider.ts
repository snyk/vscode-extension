import { BabelParser } from '../../snykOss/services/vulnerabilityCount/parsers/babelParser';
import { HtmlParser } from '../../snykOss/services/vulnerabilityCount/parsers/htmlParser';
import { ModuleParser } from '../../snykOss/services/vulnerabilityCount/parsers/moduleParser';
import { PackageJsonParser } from '../../snykOss/services/vulnerabilityCount/parsers/packageJsonParser';
import { IConfiguration } from '../configuration/configuration';
import { ILog } from '../logger/interfaces';
import { Language } from '../types';

export class ModuleParserProvider {
  static getInstance(language: Language, logger: ILog, configuration: IConfiguration): ModuleParser | undefined {
    if ([Language.TypeScript, Language.JavaScript].includes(language)) {
      return new BabelParser();
    } else if (language === Language.PJSON) {
      const cliParameters = configuration.getAdditionalCliParameters();
      return new PackageJsonParser(logger, cliParameters);
    } else if (language === Language.HTML) {
      return new HtmlParser();
    }

    return undefined;
  }
}
