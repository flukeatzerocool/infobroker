// @implements REQ-021a renderer-path
import { assertPublicUrlResolved, defaultResolver, type Resolver } from "./url-guard.js";

/**
 * REQ-021a: resolve the target and refuse a private/internal address before any
 * renderer receives it. The native path is guarded inside
 * `fetchFollowRedirects`, but every other renderer (Jina and the structured
 * ones) would otherwise dereference the URL on our behalf after only a
 * string-level check. One seam so every fetch path shares one rule, and so the
 * ordering is testable without importing the server module.
 */
export async function withGuardedTarget<T>(
  url: string,
  allowPrivate: boolean,
  dispatch: () => Promise<T>,
  resolver: Resolver = defaultResolver
): Promise<T> {
  await assertPublicUrlResolved(url, allowPrivate, resolver);
  return dispatch();
}
