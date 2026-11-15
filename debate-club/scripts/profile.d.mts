// Type declarations for profile.mjs, which is run directly by Node in lab.sh.
// The implementation is JavaScript so the Lab needs no build step.

export declare const PROFILES: Record<string, Record<string, unknown>>;
export declare function resolveProfile(name: string): Record<string, unknown>;
export declare function profileLayer(name: string): string;
export declare function profileHash(name: string): string;
