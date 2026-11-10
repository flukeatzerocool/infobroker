# Probe transcript — chunk R8

Run: 2026-11-10T16:38:46.677Z · root: `/tmp/opencode/r8-probe` · server spawned as `node --import tsx src/index.ts` over stdio MCP

| Leg | Cluster | Status | Evidence |
|---|---|---|---|
| a1 | B | pass | cold start reports state_health, no notices key |
| a2 | B | pass | notices: config_key_unrecognized |
| b1 | B | pass | layer unchanged=true, failure reported=true |
| b2 | B | pass | reload after correction: {"status":"ok","provider":"system","results":[{"message":"Configuration reloaded. Knowledge base encryption: disabled. Encryption disabled. If the store was previously encrypted it is now decrypted on |
| c | A | pass | version-stamped=true, store_backend removed=true, unknown kept=true, backups=1 |
| g | A | pass | version-stamped=true, store_backend removed=true, unknown kept=true, backups=1 |
| d-available | B | pass | cache status available reported |
| d-current | B | pass | cache status current reported |
| e-flag | E | pass | [OK] {   "status": "ok",   "provider": "native_fetch",   "results": [     {       "title": "127.0.0.1",       "url": "ht meta={"query_time_ms":24,"fallback_used":false,"content_policy":{"flagged":1,"mode":"flag"}} |
| e-block | E | pass | [ERROR] {   "status": "error",   "provider": "none",   "error": {     "code": "content_policy_flagged",     "message": "Content at http://127.0.0.1:43653/page w |
| e-off | E | pass | off stores/returns unchecked |
| f-audit | F | pass | audit exists=true mode=600 root mode=755 lines=7 refused=error |
| f-confinement | F | pass | generate_key outside keys_dir → {"status":"error","provider":"knowledge_base","error":{"code":"internal_error","message":"Key file path \"<path>\" is outside the keys directory (<path>)","remediation":"Check knowledge base configura |
| f-corrupt-state | F | pass | corrupt quota → sanitized=true |
