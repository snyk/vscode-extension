import axios from 'axios';
import { isCodeIssue, isOssIssue, OpenCommandIssueType } from '../../common/commands/types';
import { SNYK_LEARN_API_CACHE_DURATION_IN_MS } from '../../common/constants/general';
import type { completeFileSuggestionType } from '../../snykCode/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';

const ecosystems = [
  'all',
  'java',
  'javascript',
  'python',
  'golang',
  'php',
  'cpp',
  'csharp',
  'kubernetes',
  'ruby',
  'elixir',
  'docker',
  'npm',
] as const;
type LessonEcosystem = typeof ecosystems[number];

const isValidEcosystem = (potentialEcosystem: string | null | undefined): potentialEcosystem is LessonEcosystem => {
  return ecosystems.includes(potentialEcosystem as LessonEcosystem);
};

export type Lesson = {
  title: string;
  lessonId: string;
  ecosystem: LessonEcosystem;
  url: string;
};

type PackageMapper = {
  [key in LessonEcosystem]?: string[];
};

export class LearnService {
  private lessonsCache = new Map<
    string,
    {
      data: Lesson[];
      expiry: number;
    }
  >();

  constructor(private readonly logger: ILog, private readonly shouldCacheRequests = true) {}

  static getCodeIssueParams(issue: completeFileSuggestionType) {
    const cwes = issue?.cwe || [];
    const ecosystem = LearnService.convertCodeIdToEcosystem(issue.id);
    return { cwes, ecosystem };
  }

  static getOSSIssueParams(issue: OssIssueCommandArg) {
    const cwes = issue?.identifiers?.CWE || [];
    const ecosystem = LearnService.convertOSSProjectTypeToEcosystem(issue.packageManager);
    return { cwes, ecosystem };
  }

  static convertCodeIdToEcosystem(issueId: string): LessonEcosystem {
    if (!issueId) return 'all';
    const ecosystem = issueId.split(/\/|%2F/g)[0]; // %2F is the url encoding for /
    if (isValidEcosystem(ecosystem)) {
      return ecosystem;
    } else {
      return 'all';
    }
  }

  static convertOSSProjectTypeToEcosystem(pkgManager: string): LessonEcosystem {
    const snykLearnEcosystemToProjectTypeMapping: PackageMapper = {
      javascript: ['npm', 'yarn', 'yarn-workspace'],
      java: ['maven', 'gradle'],
      python: ['pip', 'poetry', 'pipenv'],
      csharp: ['nuget', 'paket'],
      php: ['composer'],
      ruby: ['rubygems'],
      golang: ['golangdep', 'govendor', 'gomodules'],
      elixir: ['hex'],
    };
    for (const [ecosystem, pkgManagers] of Object.entries(snykLearnEcosystemToProjectTypeMapping)) {
      if (pkgManagers.includes(pkgManager) && isValidEcosystem(ecosystem)) {
        return ecosystem;
      }
    }
    return 'all';
  }

  async requestLessons(cwe: string) {
    const cacheResult = this.lessonsCache.get(cwe);
    if (this.shouldCacheRequests && cacheResult && cacheResult?.expiry > Date.now()) {
      return cacheResult.data;
    } else {
      const res = await axios.get<Lesson[]>('/lessons', {
        baseURL: 'https://api.snyk.io/v1/learn',
        params: {
          cwe,
        },
      });

      this.lessonsCache.set(cwe, {
        data: res.data,
        expiry: Date.now() + SNYK_LEARN_API_CACHE_DURATION_IN_MS,
      });
      return res.data;
    }
  }

  async getLesson(
    issue: OssIssueCommandArg | completeFileSuggestionType,
    issueType: OpenCommandIssueType,
  ): Promise<Lesson | null> {
    try {
      let cwe: string;
      let ecosystem: string;

      if (isCodeIssue(issue, issueType)) {
        if (!issue.isSecurityType) return null;
        const params = LearnService.getCodeIssueParams(issue);
        cwe = params.cwes?.[0];
        ecosystem = params.ecosystem;
      } else if (isOssIssue(issue, issueType)) {
        if (issue.license) return null;
        const params = LearnService.getOSSIssueParams(issue);
        cwe = params.cwes?.[0];
        ecosystem = params.ecosystem;
      } else {
        ErrorHandler.handle(new Error(`Issue type "${issueType}" not supported`), this.logger);
        return null;
      }

      if (!cwe || !ecosystem) {
        return null;
      }
      const lessons = await this.requestLessons(cwe);
      if (lessons.length) {
        const lessonWithClosestEcosystemMatch = lessons.sort(a => (a.ecosystem === ecosystem ? -1 : 0))[0];
        return lessonWithClosestEcosystemMatch;
      } else {
        return null;
      }
    } catch (err) {
      ErrorHandler.handle(err, this.logger, 'Error getting Snyk Learn Lesson');
      return null;
    }
  }
}
