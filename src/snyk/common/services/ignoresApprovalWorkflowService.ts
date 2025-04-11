import { IVSCodeCommands } from '../vscode/commands';
import { SNYK_SUBMIT_IGNORE_COMMAND } from '../constants/commands';

export interface IIgnoresApprovalWorkflowService {
  create(workflowType: string, issue: string, ignoreType: string, reason: string, expiration: string): Promise<void>;
  edit(): Promise<void>;
  delete(): Promise<void>;
}

export class IgnoresApprovalWorkflowService implements IIgnoresApprovalWorkflowService {
  constructor(private commandExecutor: IVSCodeCommands) {}

  edit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async create(
    workflowType: string,
    issueId: string,
    ignoreType: string,
    reason: string,
    expiration: string,
  ): Promise<void> {
    try {
      const workflowTypeValue = workflowType || '';
      const issueValue = issueId || '';
      const ignoreTypeValue = ignoreType || '';
      const reasonValue = reason || '';
      const expirationValue = expiration || '';

      await Promise.race([
        this.commandExecutor.executeCommand(
          SNYK_SUBMIT_IGNORE_COMMAND,
          'create',
          issueValue,
          'wont-fix',
          reasonValue,
          '2025-12-12',
        ),
      ]);

      console.warn(`[IgnoresApprovalWorkflowService] Executed create ignore request`);
    } catch (error) {
      console.warn(`[IgnoresApprovalWorkflowService] Failed to create ignore request`);
    }
  }
}
