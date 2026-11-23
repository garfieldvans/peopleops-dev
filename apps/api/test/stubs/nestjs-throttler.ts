/**
 * Jest runs in ESM mode because Nest 12 is ESM-only. @nestjs/throttler ships a
 * CommonJS build that require()s the ESM @nestjs/common, which Jest refuses to
 * execute inside its module graph. The guard is transparent in tests; rate
 * limiting itself is covered against a running API (6th login attempt -> 429).
 */

export const ThrottlerModule = {
  forRoot: (_options?: unknown) => ({
    module: class TestThrottlerModule {},
    providers: [],
    exports: [],
  }),
};

export const Throttle = (_options?: unknown) => (): void => undefined;

export class ThrottlerGuard {
  canActivate(): boolean {
    return true;
  }
}
