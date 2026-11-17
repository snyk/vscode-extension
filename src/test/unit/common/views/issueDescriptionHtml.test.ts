import { strictEqual } from 'assert';
import { removeSnykLearnContent } from '../../../../snyk/common/views/issueDescriptionHtml';

suite('Issue description HTML', () => {
  test('removes the Snyk Learn container and preserves surrounding issue details', () => {
    const html = `
      <section class="sn-issue-header">
        <h1>SQL injection</h1>
        <div class="sn-learn">
          <div class="lesson-icon"><svg><path /></svg></div>
          <a class="lesson-link" href="https://learn.snyk.io/lesson/sql-injection/?loc=ide">
            Learn about this issue type
          </a>
        </div>
      </section>
      <main>
        <a href="https://cwe.mitre.org/data/definitions/89.html">CWE-89</a>
        <p>Issue remediation guidance</p>
      </main>`;

    strictEqual(
      removeSnykLearnContent(html),
      `
      <section class="sn-issue-header">
        <h1>SQL injection</h1>
        
      </section>
      <main>
        <a href="https://cwe.mitre.org/data/definitions/89.html">CWE-89</a>
        <p>Issue remediation guidance</p>
      </main>`,
    );
  });

  test('removes a standalone Snyk Learn link without removing unrelated links', () => {
    const html =
      '<a href="https://docs.snyk.io/products/snyk-code">Documentation</a>' +
      '<a data-source="lesson" href=https://learn.snyk.io/lesson/xss>Learn about XSS</a>' +
      '<a href="https://learn.snyk.io.evil.example/lesson/xss">Different host</a>';

    strictEqual(
      removeSnykLearnContent(html),
      '<a href="https://docs.snyk.io/products/snyk-code">Documentation</a>' +
        '<a href="https://learn.snyk.io.evil.example/lesson/xss">Different host</a>',
    );
  });

  test('leaves HTML unchanged when no Snyk Learn content is present', () => {
    const html = '<section><p>Details</p><a href="https://snyk.io/vuln/SNYK-1">SNYK-1</a></section>';

    strictEqual(removeSnykLearnContent(html), html);
  });
});
