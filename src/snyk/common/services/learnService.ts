import axios from 'axios';
import { isCodeIssue, isOssIssue, OpenCommandIssueType } from '../../common/commands/types';
import type { completeFileSuggestionType } from '../../snykCode/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
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

export interface ILearnService {
  getLesson(options: { ecosystem: LessonEcosystem; cwes?: string[]; rules?: string[] }): Promise<Lesson | null>;
}

export class LearnService implements ILearnService {
  private ecosystem: LessonEcosystem;
  private cwes: string[] = [];

  constructor(
    private readonly issue: OssIssueCommandArg | completeFileSuggestionType,
    private readonly issueType: OpenCommandIssueType,
    private readonly logger: ILog,
  ) {
    this.logger = logger;
    if (isCodeIssue(issue, issueType)) {
      this.cwes = issue?.cwe || [];
      this.ecosystem = LearnService.convertCodeIdToEcosystem(issue.id);
    } else if (isOssIssue(issue, issueType)) {
      this.cwes = issue?.identifiers?.CWE || [];
      this.ecosystem = LearnService.convertOSSProjectTypeToEcosystem(issue.packageManager);
    } else {
      logger.error(`Issue type "${issueType}" not supported`);
    }
  }

  static convertCodeIdToEcosystem(issueId: string): LessonEcosystem {
    const ecosystem = (issueId || '').split(/\/|%2F/g)[0]; // %2F is the url encoding for /
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

  async getLesson(): Promise<Lesson | null> {
    try {
      const cwe = this.cwes?.[0];
      if (!cwe || !this.ecosystem) {
        return null;
      }
      const snykLearnUrl = `https://api.snyk.io/v1/learn/lessons?cwe=${cwe}`;

      const res = await axios.get<Lesson[]>(snykLearnUrl);

      const lessons = res.data;
      if (lessons.length) {
        return lessons.sort(a => (a.ecosystem === this.ecosystem ? -1 : 0))[0];
      } else {
        return null;
      }
    } catch (_err) {
      this.logger.error('error getting snyk learn lesson');
      return null;
    }
  }
}
