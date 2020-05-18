import {
  ServiceAI,
  AnalyseRequestDto
} from "@deepcode/tsc";

import { IDE_NAME } from "../constants/general";

const AI = new ServiceAI();

const http = {
  
  login(baseURL: string, source: string = IDE_NAME): Promise<any> {
    return AI.startSession({ baseURL, source });
  },

  async checkSession(baseURL: string, sessionToken: string): Promise<any> {
    return AI.checkSession({ baseURL, sessionToken });
  },

  getFilters(baseURL: string, sessionToken: string): Promise<any> {
    return AI.getFilters({ baseURL, sessionToken});
  },

  getServiceAI() {
    return AI;
  },

  analyse(baseURL: string, sessionToken: string, baseDir: string, files: string[], removedFiles: string[] = []) {
    const options: AnalyseRequestDto = {
      baseURL,
      sessionToken,
      baseDir,
      files,
      removedFiles,
    };
    console.log('options --> ', options);
    
    return AI.analyse(options);
  },

  // TODO: when API package will implement such functionality
  // we would have the possibility to send an error to server
  async sendError(body: any): Promise<void> {
    return Promise.resolve();
  }
};

export default http;
