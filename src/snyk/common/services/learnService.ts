import axios from 'axios';
import { isCodeIssue, isOssIssue, OpenCommandIssueType } from '../../common/commands/types';
import { SNYK_LEARN_API_CACHE_DURATION_IN_MS } from '../../common/constants/general';
import type { completeFileSuggestionType } from '../../snykCode/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
import { IConfiguration } from '../configuration/configuration';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';

export type Lesson = {
  title: string;
  lessonId: string;
  ecosystem: string;
  url: string;
};

interface LessonLookupParams {
  rule: string;
  ecosystem: string;
  cwes?: string[];
  cves?: string[];
}

export class LearnService {
  private lessonsCache = new Map<
    string,
    {
      lessons: Lesson[];
      expiry: number;
    }
  >();

  constructor(
    private readonly configuration: IConfiguration,
    private readonly logger: ILog,
    private readonly shouldCacheRequests = true,
  ) {}

  static getCodeIssueParams(issue: completeFileSuggestionType): LessonLookupParams {
    const idParts = issue.id.split(/\/|%2F/g);

    return {
      rule: idParts[idParts.length - 1],
      ecosystem: idParts[0],
      cwes: issue.cwe,
    };
  }

  static getOSSIssueParams(issue: OssIssueCommandArg): LessonLookupParams {
    return {
      rule: issue.id,
      ecosystem: issue.packageManager,
      cwes: issue.identifiers?.CWE,
      cves: issue.identifiers?.CVE,
    };
  }

  async requestLessons(params: LessonLookupParams) {
    const cacheResult = this.lessonsCache.get(params.rule);

    if (this.shouldCacheRequests && cacheResult && cacheResult?.expiry > Date.now()) {
      return cacheResult.lessons;
    } else {
      const res = await axios.get<{ lessons: Lesson[] }>('/lessons/lookup-for-cta', {
        baseURL: this.snykLearnEndpoint,
        params: {
          source: 'ide',
          rule: params.rule,
          ecosystem: params.ecosystem,
          cwe: params.cwes?.[0],
          cve: params.cves?.[0],
        },
      });

      const lessons = res.data.lessons;

      this.lessonsCache.set(params.rule, {
        lessons,
        expiry: Date.now() + SNYK_LEARN_API_CACHE_DURATION_IN_MS,
      });

      return lessons;
    }
  }

  async getLesson(
    issue: OssIssueCommandArg | completeFileSuggestionType,
    issueType: OpenCommandIssueType,
  ): Promise<Lesson | null> {
    try {
      let params: LessonLookupParams | null = null;

      if (isCodeIssue(issue, issueType)) {
        if (!issue.isSecurityType) return null;

        params = LearnService.getCodeIssueParams(issue);
      } else if (isOssIssue(issue, issueType)) {
        // Snyk Learn does not currently deal with licensing issues.
        if (issue.license) return null;

        params = LearnService.getOSSIssueParams(issue);
      } else {
        ErrorHandler.handle(new Error(`Issue type "${issueType}" not supported`), this.logger);
        return null;
      }

      if (!params) {
        return null;
      }

      const lessons = await this.requestLessons(params);
      if (!lessons.length) {
        return null;
      } else {
        const lesson = lessons[0];
        const lessonURL = new URL(lesson.url);
        lessonURL.searchParams.set('loc', 'ide');
        return { ...lesson, url: lessonURL.toString() };
      }
      return lessons.length > 0 ? lessons[0] : null;
    } catch (err) {
      ErrorHandler.handle(err, this.logger, 'Error getting Snyk Learn Lesson');
      return null;
    }
  }

  get snykLearnEndpoint(): string {
    return `${this.configuration.baseApiUrl}/v1/learn`;
  }
}
