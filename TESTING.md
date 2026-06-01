# Testing Guide

## Overview

InnerSpace uses **Jest** for unit and integration testing. This guide explains how to run tests, write new tests, and maintain test coverage.

## Quick Start

```bash
# Install dev dependencies (if not already installed)
npm install

# Run all tests
npm run test

# Run tests in watch mode (re-run on file change)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Structure

Tests are located in `src/**/__tests__/` directories:

```
src/
├── services/
│   └── __tests__/
│       ├── safety-filter.test.ts          # Safety filter validation
│       └── storage-encryption.test.ts     # Encryption/decryption
├── components/
│   └── __tests__/
│       └── ErrorBoundary.test.tsx         # Error handling
└── utils/
    └── __tests__/
        └── date.test.ts                   # Utility functions
```

## Writing Tests

### Basic Test Structure

```typescript
describe('Feature Name', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Testing Services

```typescript
// src/services/__tests__/example.test.ts

import { myService } from '../my-service';

describe('MyService', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('should handle success case', async () => {
    const result = await myService.doSomething();
    expect(result).toBeDefined();
  });

  it('should handle error case', async () => {
    await expect(myService.throwError()).rejects.toThrow();
  });
});
```

### Testing React Components

```typescript
// src/components/__tests__/MyComponent.test.tsx

import { render, screen } from '@testing-library/react-native';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText(/test/i)).toBeDefined();
  });
});
```

## Running Specific Tests

```bash
# Run tests for a specific file
npm run test -- safety-filter.test.ts

# Run tests matching a pattern
npm run test -- --testNamePattern="should block crisis"

# Run tests in a specific directory
npm run test -- src/services/__tests__/
```

## Coverage

```bash
# Generate and view coverage report
npm run test:coverage

# Coverage thresholds (from jest.config.js):
# - Branches: 50%
# - Functions: 50%
# - Lines: 50%
# - Statements: 50%
```

View the HTML report:
```bash
open coverage/lcov-report/index.html
```

## Mocking

### Mock AsyncStorage

```typescript
// Already mocked in jest.setup.js
import AsyncStorage from '@react-native-async-storage/async-storage';

AsyncStorage.getItem.mockResolvedValueOnce('test-value');
```

### Mock expo-secure-store

```typescript
// Already mocked in jest.setup.js
import * as SecureStore from 'expo-secure-store';

SecureStore.getItemAsync.mockResolvedValueOnce('key');
```

### Mock API Calls

```typescript
import { callGeminiAPI } from '../src/services/gemini-service';

jest.mock('../src/services/gemini-service');

(callGeminiAPI as jest.Mock).mockResolvedValueOnce({
  text: 'AI response',
  isSafetyRedirect: false,
});
```

## Critical Tests

These tests **must** pass before any code changes are merged:

1. **Safety Filter** (`src/services/__tests__/safety-filter.test.ts`)
   - Tests all 7 safety rules
   - Tests edge cases (unicode, long text, case-insensitivity)
   - Minimum 30 test cases

2. **Encryption** (`src/services/__tests__/storage-encryption.test.ts`)
   - Tests encryption/decryption roundtrips
   - Tests key management
   - Tests tampering detection
   - Minimum 20 test cases

3. **Backup Service** (to be added)
   - Tests export format
   - Tests import validation
   - Minimum 15 test cases

4. **Error Boundary** (to be added)
   - Tests error catching
   - Tests fallback UI
   - Minimum 5 test cases

## Best Practices

### Do ✅

- Write tests for critical business logic (safety, encryption, payments)
- Use descriptive test names: `should block suicide-related keywords`
- Group related tests with `describe` blocks
- Test both happy path and error cases
- Mock external dependencies (API calls, storage, etc.)
- Use `beforeEach` to reset mocks between tests

### Don't ❌

- Test implementation details (test behavior, not code)
- Mock everything (test real logic where possible)
- Ignore failing tests
- Commit code that reduces coverage
- Write flaky tests (time-dependent, order-dependent)

## Troubleshooting

### Tests won't run

```bash
# Clear Jest cache
npm run test -- --clearCache

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Module not found errors

```bash
# Check jest.config.js moduleNameMapper
# Make sure path aliases are correct
```

### Async test timeout

```typescript
it('should handle long operation', async () => {
  // Add timeout (default 5000ms)
  const result = await slowFunction();
  expect(result).toBeDefined();
}, 10000); // 10 second timeout
```

## CI/CD Integration

Tests run automatically on:
- **Pull Request:** Before merge is allowed
- **Commit:** Via pre-commit hook (if husky configured)
- **Release:** Before publishing

See `.github/workflows/` for CI configuration.

## Next Steps

1. ✅ Jest setup complete
2. ⏳ Add tests for encryption service
3. ⏳ Add tests for backup service
4. ⏳ Add tests for Error Boundary
5. ⏳ Reach 70% coverage threshold
6. ⏳ Add E2E tests with Detox

## Resources

- [Jest Docs](https://jestjs.io/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)
- [Testing Library](https://testing-library.com/)
- [Best Practices](https://testingjavascript.com/)

---

**Need help?** Open an issue or check [SETUP.md](SETUP.md) for environment setup.
