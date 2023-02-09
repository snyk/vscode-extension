import { AnalysisSeverity } from '@snyk/code-client';
import { strictEqual } from 'assert';
import sinon from 'sinon';
import { Configuration } from '../../../../snyk/common/configuration/configuration';
import {
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  SEVERITY_FILTER_SETTING,
} from '../../../../snyk/common/constants/settings';
import SnykCodeAnalyzer from '../../../../snyk/snykCode/analyzer/analyzer';
import { stubWorkspaceConfiguration } from '../../mocks/workspace.mock';

suite('Snyk Code Analyzer', () => {
  teardown(() => {
    sinon.restore();
  });

  test('Security Issue is visible if Code Security is enabled', () => {
    const securityIssue = true;
    const workspace = stubWorkspaceConfiguration(CODE_SECURITY_ENABLED_SETTING, true);
    const config = new Configuration({}, workspace);

    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, securityIssue, AnalysisSeverity.critical), true);
  });

  test('Security Issue is not visible if Code Security is disabled', () => {
    const securityIssue = true;
    const workspace = stubWorkspaceConfiguration(CODE_SECURITY_ENABLED_SETTING, false);
    const config = new Configuration({}, workspace);

    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, securityIssue, AnalysisSeverity.critical), false);
  });

  test('Quality Issue is visible if Code Quality is enabled', () => {
    const securityIssue = false;
    const workspace = stubWorkspaceConfiguration(CODE_QUALITY_ENABLED_SETTING, true);
    const config = new Configuration({}, workspace);

    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, securityIssue, AnalysisSeverity.critical), true);
  });

  test('Quality Issue is not visible if Code Quality is disabled', () => {
    const securityIssue = false;
    const workspace = stubWorkspaceConfiguration(CODE_QUALITY_ENABLED_SETTING, false);
    const config = new Configuration({}, workspace);

    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, securityIssue, AnalysisSeverity.critical), false);
  });

  test('Critical severity issue respects high severity filter', () => {
    const filter = {
      critical: false,
      high: false,
    };
    const workspace = stubWorkspaceConfiguration(SEVERITY_FILTER_SETTING, filter);
    const config = new Configuration({}, workspace);

    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, true, AnalysisSeverity.critical), false);

    filter.high = true;
    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, true, AnalysisSeverity.critical), true);
  });

  test('Warning severity issue respects medium severity filter', () => {
    const filter = {
      medium: false,
    };
    const workspace = stubWorkspaceConfiguration(SEVERITY_FILTER_SETTING, filter);
    const config = new Configuration({}, workspace);

    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, true, AnalysisSeverity.warning), false);

    filter.medium = true;
    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, true, AnalysisSeverity.warning), true);
  });

  test('Info severity issue is not visible if low severity is disabled', () => {
    const filter = {
      low: false,
    };
    const workspace = stubWorkspaceConfiguration(SEVERITY_FILTER_SETTING, filter);
    const config = new Configuration({}, workspace);

    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, true, AnalysisSeverity.info), false);

    filter.low = true;
    strictEqual(SnykCodeAnalyzer.isIssueVisible(config, true, AnalysisSeverity.info), true);
  });
});
