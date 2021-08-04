import { Configuration } from './configuration';
import { VSCodeWorkspace } from '../vscode/workspace';

export const configuration = new Configuration(process.env, new VSCodeWorkspace());
