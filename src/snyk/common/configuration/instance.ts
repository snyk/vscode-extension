import { Configuration, IConfiguration } from './configuration';
import { VSCodeWorkspace } from '../vscode/workspace';

export const configuration: IConfiguration = new Configuration(process.env, new VSCodeWorkspace());
