import {
  ServiceAI,
  IConfig,
  IFiles,
  IFileContent,
  StartSessionRequestDto,
  StartSessionResponseDto,
  CheckSessionRequestDto,
  CheckSessionResponseDto,
  GetFiltersRequestDto,
  GetFiltersResponseDto,
  UploadFilesRequestDto,
  GetAnalysisRequestDto,
  AnalyseRequestDto
} from "@deepcode/tsc";

import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { BASE_URL, IDE_NAME } from "../constants/general";

const AI = new ServiceAI();
AI.init({
  baseURL: BASE_URL,
  useDebug: true,
} as IConfig);

const http = {
  init(config: IConfig): void {
    AI.init(config);
  },

  async login(): Promise<StartSessionResponseDto> {
    const options: StartSessionRequestDto = {
      source: IDE_NAME,
    };
    const result = await AI.startSession(options);

    return Promise.resolve(result as StartSessionResponseDto);
  },

  async checkLoginStatus(sessionToken: string): Promise<CheckSessionResponseDto> {
    const options: CheckSessionRequestDto = {
      sessionToken,
    };
    const result = await AI.checkSession(options);

    return Promise.resolve(result as CheckSessionResponseDto);
  },

  async getFilters(sessionToken: string): Promise<GetFiltersResponseDto> {
    const options: GetFiltersRequestDto = {
      sessionToken,
    };
    const result = await AI.getFilters(options);

    return Promise.resolve(result as GetFiltersResponseDto);
  },

  getServiceAI() {
    return AI;
  },

  async uploadFiles(sessionToken: string, bundleId: string, body: any): Promise<void> {
    const options: UploadFilesRequestDto = {
      sessionToken,
      bundleId,
      content: (body as IFileContent[]),
    };
    await AI.uploadFiles(options);

    return Promise.resolve();
  },

  async getAnalysis(sessionToken: string, bundleId: string): Promise<DeepCode.AnalysisServerResponseInterface> {
    const options: GetAnalysisRequestDto = {
      sessionToken,
      bundleId,
    };
    const result = await AI.getAnalysis(options);

    return Promise.resolve(result as unknown as DeepCode.AnalysisServerResponseInterface);
  },

  async analyse(files: string[], sessionToken: string, removedFiles: string[] = []) {
    const options: AnalyseRequestDto = {
      files,
      sessionToken,
      removedFiles,
    };
    
    try {
      return AI.analyse(options);

    } catch (error) {
      const { statusCode } = error;

      return Promise.resolve({ error, statusCode });
    }
  },

  // TODO: when API package will implement such functionality
  // we would have the possibility to send an error to server
  async sendError(body: any): Promise<void> {
    return Promise.resolve();
  }
};

export default http;
