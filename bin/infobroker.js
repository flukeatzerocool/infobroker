#!/usr/bin/env node
import("../dist/index.js").catch((e) => {
  console.error("infobroker failed to start:", e);
  process.exit(1);
});
