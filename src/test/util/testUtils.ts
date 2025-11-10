/**
 * Asserts that a condition eventually becomes true within the given timeout.
 * Similar to assert.Eventually in Go's testify library.
 *
 * @param condition - Function that returns true when the expected condition is met
 * @param timeout - Maximum time to wait in milliseconds (default: 2000ms)
 * @param interval - Polling interval in milliseconds (default: 50ms)
 * @param message - Optional custom error message
 * @throws Error if condition doesn't become true within timeout
 */
export async function assertEventually(
  condition: () => boolean,
  timeout: number = 2000,
  interval: number = 50,
  message?: string,
): Promise<void> {
  const start = Date.now();

  while (!condition()) {
    if (Date.now() - start > timeout) {
      const errorMessage = message || `Condition not met within ${timeout}ms`;
      throw new Error(errorMessage);
    }
    // eslint-disable-next-line no-await-in-loop -- Sequential await is intentional for polling
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}
