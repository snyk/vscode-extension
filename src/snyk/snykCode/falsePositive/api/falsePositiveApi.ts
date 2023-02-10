import { SnykApiClient } from '../../../common/api/apiСlient';
import { User } from '../../../common/user';
import { FalsePositive } from '../falsePositive';

export interface IFalsePositiveApi {
  report(falsePositive: FalsePositive, user: User): Promise<void>;
}

type FalsePositivePayload = {
  topic: string;
  message: string;
  feedbackOrigin: 'ide';
  context: {
    issueId: string;
    userPublicId: string;
    startLine: number;
    endLine: number;
    primaryFilePath: string;
    vulnName: string;
    fileContents: string;
  };
};

export class FalsePositiveApi extends SnykApiClient implements IFalsePositiveApi {
  report(falsePositive: FalsePositive, user: User): Promise<void> {
    if (!falsePositive.content?.length) {
      throw new Error("False positive shouldn't be empty.");
    }
    if (!user.authenticatedId) {
      throw new Error('Unauthenticated users cannot report false positives.');
    }

    const payload: FalsePositivePayload = {
      topic: 'False Positive',
      message: falsePositive.message,
      feedbackOrigin: 'ide',
      context: {
        issueId: falsePositive.id,
        fileContents: falsePositive.content,
        startLine: falsePositive.startLine,
        endLine: falsePositive.endLine,
        primaryFilePath: falsePositive.primaryFilePath,
        userPublicId: user.authenticatedId,
        vulnName: falsePositive.rule,
      },
    };

    return this.post('feedback/sast', payload);
  }
}
