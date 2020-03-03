/* eslint-disable no-console, no-magic-numbers, max-statements */

import { existsSync } from "fs";
import { join } from "path";

/**
 * search for actual app dir by looking for package.json
 *
 * @param dir starting dir
 * @param depth levels so far (to avoid infinite searching)
 * @returns dir if found
 */
function searchAppDir(dir: string, depth = 0): string {
  if (depth > 50) {
    return "";
  }

  const file = join(dir, "package.json");
  if (existsSync(file)) {
    return dir;
  }

  const newDir = join(dir, "..");
  if (newDir !== dir) {
    return searchAppDir(newDir, depth + 1);
  }

  return "";
}

/**
 * Setup npm scripts for bootstrapping a module project
 */
function installSetup(): void {
  // console.error("@xarc/module-dev post install, env INIT_CWD", process.env.INIT_CWD);
  const appDir = searchAppDir(process.env.INIT_CWD || "");

  if (appDir && (existsSync(join(appDir, "xclap.js")) || existsSync(join(appDir, "xclap.ts")))) {
    return;
  }

  console.error(`Welcome to @xarc/module-dev for developing node.js modules.

To bootstrap your project, run:

    npx clap --require @xarc/module-dev init [options]

Options:

  --eslint        - bootstrap with eslint support
  --no-typescript - don't bootstrap with typescript support`);
}

installSetup();
