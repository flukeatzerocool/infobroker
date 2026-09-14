// @implements REQ-105
// Atomic, owner-only file writes and timestamped backup copies for the
// user-config migration path (REQ-105). A failed write leaves the original file
// intact; a backup is an independent copy so a migration is always recoverable.
import {
  writeSync,
  openSync,
  closeSync,
  fsyncSync,
  renameSync,
  chmodSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, basename, join } from "node:path";
import { randomBytes } from "node:crypto";

export function atomicWriteFile(fpath: string, bytes: Buffer, mode = 0o600): void {
  const dir = dirname(fpath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${basename(fpath)}.tmp-${randomBytes(6).toString("hex")}`);
  try {
    const fd = openSync(tmp, "w", mode);
    try {
      writeSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    chmodSync(tmp, mode);
    renameSync(tmp, fpath);
    // Best-effort directory fsync for rename durability; unsupported on some
    // filesystems (Windows, some FUSE). The rename itself is already atomic.
    try {
      const dfd = openSync(dir, "r");
      try {
        fsyncSync(dfd);
      } finally {
        closeSync(dfd);
      }
    } catch {
      // directory fsync unsupported — safe to ignore, rename already committed
    }
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // best-effort cleanup of the temp file
    }
    throw e;
  }
}

/**
 * Copy `fpath` to a timestamped sibling backup at 0600 and return the backup
 * path, or null when the source does not exist. A random suffix keeps two
 * migrations in the same second from colliding.
 */
export function backupFile(fpath: string): string | null {
  if (!existsSync(fpath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dst = `${fpath}.bak-${stamp}-${randomBytes(3).toString("hex")}`;
  copyFileSync(fpath, dst);
  chmodSync(dst, 0o600);
  return dst;
}
