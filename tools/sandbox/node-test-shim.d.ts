// Minimal ambient declarations for `node:test` / `node:assert/strict` so this
// SANDBOX-ONLY tsconfig can type-check test files without `@types/node`
// installed (this build environment has no npm registry access). A normal
// `npm install` on a real machine pulls in `@types/node`, which provides the
// full, accurate types — this shim is never referenced by the shipped
// tsconfig.json and should be deleted once @types/node is installed.
declare module "node:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function before(fn: () => void | Promise<void>): void;
  export function after(fn: () => void | Promise<void>): void;
}

declare module "node:assert/strict" {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  }
  const assert: Assert;
  export default assert;
}
