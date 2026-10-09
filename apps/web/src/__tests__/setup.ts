import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Slow CI machines and parallel test runs must not turn into flaky "element not found" failures.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
