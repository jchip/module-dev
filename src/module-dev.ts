/* eslint-disable no-console, global-require, no-magic-numbers, max-statements */
import * as Path from "path";
import * as xsh from "xsh";
import * as Fs from "fs";
import * as filterScanDir from "filter-scan-dir";
import * as xclap from "xclap";
import * as _ from "lodash";

const typedocDeps = {
  typedoc: "^0.16.11"
};

const typeScriptDevDeps = {
  // code coverage
  "@istanbuljs/nyc-config-typescript": "^1.0.1",
  "source-map-support": "^0.5.16",
  // types for node.js
  "@types/node": "^13.7.6",
  // compilers
  "ts-node": "^8.6.2",
  typescript: "^3.8.3"
};

const eslintDevDeps = {
  "babel-eslint": "^10.1.0",
  eslint: "^6.8.0",
  "eslint-config-walmart": "^2.2.1",
  "eslint-plugin-filenames": "^1.1.0",
  "eslint-plugin-jsdoc": "^21.0.0"
};

const eslintTSDevDeps = {
  // eslint typescript deps
  "@typescript-eslint/eslint-plugin": "^2.21.0",
  "@typescript-eslint/parser": "^2.21.0"
};

/**
 * User configurable options for @xarc/module-dev tasks
 */
export type XarcModuleDevOptions = {
  /** force terminal colors in output - *default* `true` */
  forceColor?: boolean;
  /** Specify a XClap instance to use - *default* `require("xclap")` */
  xclap?: any; // type not available for xclap yet
  /** turn off/on linting tasks (using eslint) - *default* `true` */
  enableLinting?: boolean;
  /** Specify typescript config to override the default one */
  tsConfig?: Record<string, any>;
};

/**
 * setup PATH
 */
function setupPath(): void {
  xsh.envPath.addToFront(Path.resolve("node_modules/.bin"));
  xsh.envPath.addToFront(Path.join(__dirname, "../node_modules/.bin"));
}

/**
 * Sort property keys of an object
 *
 * @param obj object
 * @returns obj new object with property keys sorted
 */
function sortObjKeys<T extends object>(obj: T): T {
  return (Object.keys(obj) as (keyof T)[]).sort().reduce((newObj, key) => {
    newObj[key] = obj[key];
    return newObj;
  }, {} as T);
}

/**
 * read app's package.json
 *
 * @returns package JSON data
 */
function readAppPkgJson(): Record<string, any> {
  return JSON.parse(Fs.readFileSync(Path.resolve("package.json")).toString());
}

/**
 * write app's package.json with pkg
 *
 * @param pkg pkg data to write
 */
function writeAppPkgJson(pkg: {}): void {
  const data = JSON.stringify(pkg, null, 2);
  Fs.writeFileSync(Path.resolve("package.json"), `${data}\n`);
}

class XarcModuleDev {
  appPkg: Record<string, any>;
  hasEslint: boolean;
  hasTypeScript: boolean;
  hasTypedoc: boolean;
  existAppPkgData: string;
  tsConfig: Record<string, any>;

  constructor(options: XarcModuleDevOptions) {
    this.loadAppPkg();
    const defaultTsConfig = {
      compilerOptions: {
        outDir: "dist",
        lib: ["es2018"],
        module: "CommonJS",
        esModuleInterop: false,
        target: "ES2018",
        preserveConstEnums: true,
        sourceMap: true,
        declaration: true,
        types: ["node"],
        forceConsistentCasingInFileNames: true,
        noImplicitReturns: true,
        alwaysStrict: true,
        // we are not ready for strict null checks
        // strictNullChecks: true,
        strictFunctionTypes: true
      },
      include: ["src"]
    };
    this.tsConfig = options.tsConfig || defaultTsConfig;
  }

  loadAppPkg() {
    this.appPkg = readAppPkgJson();
    this.existAppPkgData = JSON.stringify(this.appPkg);
    this.updateFeatures();
  }

  updateFeatures() {
    this.hasEslint = this.appHasDevDeps(...Object.keys(eslintDevDeps));
    this.hasTypeScript = this.appHasDevDeps(...Object.keys(typeScriptDevDeps));
    this.hasTypedoc = this.appHasDevDeps(...Object.keys(typedocDeps));
  }

  setupXclapFile() {
    const saveFile = (name, content) => {
      if (!Fs.existsSync(name)) {
        Fs.writeFileSync(name, content);
      }
    };

    if (this.hasTypeScript) {
      saveFile(
        Path.resolve("xclap.ts"),
        `import { loadTasks } from "@xarc/module-dev";
loadTasks();
`
      );
    } else {
      saveFile(
        Path.resolve("xclap.js"),
        `require("@xarc/module-dev")();
`
      );
    }
  }

  setupGitIgnore() {
    const gi = ".gitignore";
    if (!Fs.existsSync(Path.resolve(gi))) {
      Fs.writeFileSync(
        Path.resolve(gi),
        `.nyc_output
coverage
dist
node_modules
# recommend avoid committing package-lock.* file because a module's CI
# should use latest dep, as an app that consumes a module would have its
# own lockfile, but remove this if you want to commit the package lock file.
*-lock*
`
      );
      console.log("INFO: created .gitignore file for you.");
    }
  }

  addDevDeps(...features: string[]) {
    const isTs = features.includes("typescript");
    const isEslint = features.includes("eslint");
    const isTypedoc = features.includes("typedoc");

    if (isTs) {
      this.addDevDepsToAppPkg(typeScriptDevDeps);
    }

    if (isEslint) {
      this.addDevDepsToAppPkg(eslintDevDeps);
    }

    this.updateFeatures();

    if (this.hasTypeScript && this.hasEslint) {
      this.addDevDepsToAppPkg(eslintTSDevDeps);
    }

    if (isTypedoc) {
      this.addDevDepsToAppPkg(typedocDeps);
      if (!this.hasTypeScript) {
        console.log(`ERROR: typedoc support requires typescript.`);
      }
    }

    if (this.saveAppPkgJson()) {
      const x = features.join(", ");
      console.log(`INFO: ${x} dependencies added to your package.json, please install modules again.
  ie: run 'npm install' for npm`);
    }
  }

  rmDevDeps(...features: string[]) {
    const isTs = features.includes("typescript");
    const isEslint = features.includes("eslint");
    const isTypedoc = features.includes("typedoc");

    if (isTs) {
      this.rmDevDepsFromAppPkg(typeScriptDevDeps);
    }

    if (isEslint) {
      this.rmDevDepsFromAppPkg(eslintDevDeps);
    }

    if (isTypedoc) {
      this.rmDevDepsFromAppPkg(typedocDeps);
    }

    if (isTs || isEslint) {
      this.rmDevDepsFromAppPkg(eslintTSDevDeps);
    }

    if (this.saveAppPkgJson()) {
      const x = features.join(", ");
      console.log(`INFO: ${x} dependencies removed from your package.json. please install modules again.
  ie: run 'npm install' for npm`);
    }
  }

  saveAppPkgJson(): boolean {
    const newData = JSON.stringify(this.appPkg);
    if (this.existAppPkgData !== newData) {
      this.existAppPkgData = newData;
      writeAppPkgJson(this.appPkg);
      this.updateFeatures();
      return true;
    }
    return false;
  }

  addDevDepsToAppPkg(dev: Record<string, string>) {
    const devDep = this.appPkg.devDependencies || {};
    for (const k in dev) {
      devDep[k] = dev[k];
    }
    this.appPkg.devDependencies = sortObjKeys(devDep);
  }

  rmDevDepsFromAppPkg(dev: Record<string, string>) {
    const devDep = this.appPkg.devDependencies || {};
    for (const k in dev) {
      delete devDep[k];
    }
    if (Object.keys(devDep).length === 0) {
      delete this.appPkg.devDependencies;
    } else {
      this.appPkg.devDependencies = sortObjKeys(devDep);
    }
  }

  appHasDevDeps(...deps: string[]): boolean {
    return deps.every(x => {
      const dd = this.appPkg.devDependencies;
      return dd && dd.hasOwnProperty(x);
    });
  }

  lintTask(dir: string): string[] {
    const scanned = filterScanDir.sync({
      dir,
      grouping: true,
      filter(file, path, extras) {
        if ([".ts", ".tsx", ".js", ".jsx"].includes(extras.ext)) {
          return extras.ext.substr(1, 2);
        }
        return true;
      }
    });
    const tasks: string[] = [];
    if (scanned.js) {
      tasks.push(`.lint-${dir}-js`);
    }
    if (this.hasTypeScript && scanned.ts) {
      tasks.push(`.lint-${dir}-ts`);
    }
    return tasks;
  }

  setupTsConfig(): void {
    if (!this.hasTypeScript) {
      return;
    }
    const file = Path.resolve("tsconfig.json");
    let tsConfig = {};
    try {
      tsConfig = JSON.parse(Fs.readFileSync(file).toString());
    } catch {
      tsConfig = {};
    }
    const existData = JSON.stringify(tsConfig);
    const finalTsConfig = _.merge({}, this.tsConfig, tsConfig);
    if (JSON.stringify(finalTsConfig) !== existData) {
      Fs.writeFileSync(file, `${JSON.stringify(finalTsConfig, null, 2)}\n`);
      console.log("INFO: updated tsconfig.json for you.  Please commit it");
    }
  }

  setupPublishingConfig(): void {
    const files = this.appPkg.files || [];

    if (this.hasTypeScript) {
      files.push("dist");
    }

    if (Fs.existsSync(Path.resolve("lib"))) {
      files.push("lib");
    }

    this.appPkg.files = _.uniq(files).sort();
    if (this.saveAppPkgJson()) {
      console.log(`INFO: updated files in your package.json for publishing.`);
    }
  }

  setupCompileScripts(): void {
    if (!this.hasTypeScript) {
      return;
    }
    const scripts = this.appPkg.scripts || {};
    this.appPkg.scripts = scripts;
    const prepublishTasks = ["build"];
    if (this.hasTypedoc) {
      prepublishTasks.push("docs");
    }
    this.appPkg.scripts = _.merge({}, scripts, {
      build: "tsc",
      prepublishOnly: `clap -n ${prepublishTasks.join(" ")}`
    });
    if (this.saveAppPkgJson()) {
      console.log(`INFO: added build and prepublishOnly npm scripts for your typescript.`);
    }
  }

  setupTypedocScripts(): void {
    if (!this.hasTypedoc) {
      return;
    }
    this.updateFeatures();
    const scripts = this.appPkg.scripts || {};
    this.appPkg.scripts = scripts;
    _.defaults(scripts, {
      docs: `typedoc --excludeNotExported --out docs src`
    });
    if (this.saveAppPkgJson()) {
      console.log(`INFO: added docs npm scripts for your typescript.`);
    }
  }

  setupMocha(): void {
    const mochaOpts = this.appPkg.mocha || {};
    this.appPkg.mocha = mochaOpts;

    const tsNodeReg = "ts-node/register";
    const sourceMapReg = "source-map-support/register";
    const selfPkg = "@xarc/module-dev";
    const withSelf = this.appHasDevDeps(selfPkg) ? `${selfPkg}` : ".";
    const testSetup = `${withSelf}/config/test/setup.js`;

    const mochaRequires = _.without(mochaOpts.require || [], tsNodeReg, sourceMapReg, testSetup);

    if (this.appHasDevDeps("ts-node")) {
      mochaRequires.push(tsNodeReg);
    }

    if (this.appHasDevDeps("source-map-support")) {
      mochaRequires.push(sourceMapReg);
    }

    mochaRequires.push(testSetup);
    mochaOpts.require = _.uniq(mochaRequires);
    _.defaults(mochaOpts, { recursive: true });

    if (this.saveAppPkgJson()) {
      console.log(`INFO: updated mocha options in your package.json. Please commit it.`);
    }
  }

  setupCoverage(): void {
    const nyc = this.appPkg.nyc || {};

    const nycConfigTs = "@istanbuljs/nyc-config-typescript";
    const nycExtends = _.without(nyc.extends || [], nycConfigTs);
    if (this.hasTypeScript) {
      nycExtends.push(nycConfigTs);
    }

    nyc.extends = _.uniq(nycExtends);
    _.defaults(nyc, {
      all: true,
      reporter: [],
      exclude: [],
      "check-coverage": true,
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
      cache: !this.hasTypeScript
    });
    nyc.reporter = _.uniq(nyc.reporter.concat(["lcov", "text", "text-summary"]).sort());
    nyc.exclude = _.uniq(
      nyc.exclude
        .concat(["coverage", "docs", "*clap.js", "*clap.ts", "gulpfile.js", "dist", "test"])
        .sort()
    );
    this.appPkg.nyc = nyc;
    if (this.saveAppPkgJson()) {
      console.log("INFO: updated nyc config in your package.json. Please commit it.");
    }
  }
}

/**
 * Make XClap build tasks
 *
 * @param options options
 * @returns tasks
 */
function makeTasks(options: XarcModuleDevOptions) {
  if (options.forceColor !== false) {
    process.env.FORCE_COLOR = "true";
  }

  const { serial } = options.xclap;

  const xarcModuleDev = new XarcModuleDev(options);

  const lint = options.enableLinting !== false && xarcModuleDev.hasEslint;

  const invokeLint = () => {
    return !lint
      ? []
      : ([] as string[])
          .concat(...["lib", "src", "test"].map(x => xarcModuleDev.lintTask(x)))
          .filter(x => x);
  };

  const tasks = {
    test: ["lint", "test-only"],
    check: ["lint", "test-cov"],
    typescript: {
      desc: "Add config and deps to your project for typescript support",
      task: [
        "add-typescript-deps",
        () => {
          xarcModuleDev.setupTsConfig();
          xarcModuleDev.setupCompileScripts();
        }
      ]
    },
    typedoc: {
      desc: "Add support to your project for generating API docs using typedoc",
      task: [
        "add-typedoc-deps",
        () => {
          xarcModuleDev.setupTypedocScripts();
          xarcModuleDev.setupCompileScripts();
        }
      ]
    },
    eslint: {
      desc: "Add config and deps to your project for eslint support",
      task: ["add-eslint-deps"]
    },
    init: {
      desc: `Bootstrap a project for development with @xarc/module-dev
          Options: --no-typescript --no-typedoc --eslint`,
      task() {
        const initTasks: (Function | string)[] = [];
        const noTs = "--no-typescript";
        const eslint = "--eslint";
        const noTd = "--no-typedoc";
        const xtra = _.without(this.argv, noTs, eslint, noTd, "init");
        if (xtra.length > 0) {
          throw new Error(`Unknown options for init task ${xtra.join(", ")}`);
        }
        if (!this.argv.includes(noTs)) {
          initTasks.push("typescript");
        }
        if (this.argv.includes(eslint)) {
          initTasks.push("eslint");
        }
        if (!this.argv.includes(noTd)) {
          initTasks.push("typedoc");
        }
        initTasks.push(() => {
          xarcModuleDev.loadAppPkg();
          xarcModuleDev.setupXclapFile();
          xarcModuleDev.setupPublishingConfig();
          xarcModuleDev.setupMocha();
          xarcModuleDev.setupGitIgnore();
        });
        return serial(initTasks);
      }
    },
    "rm-typescript": {
      desc: "Remove config and deps from your project for typescript support",
      task: ["rm-typescript-deps"]
    },
    "rm-eslint": {
      desc: "Remove config and deps from your project for eslint support",
      task: ["rm-eslint-deps"]
    },
    "test-only": {
      desc: "Run just your unit tests (generate test/mocha.opts if not exist)",
      task: () => {
        xarcModuleDev.setupPublishingConfig();
        xarcModuleDev.setupMocha();
        return ".test-only";
      }
    },
    ".test-only": `mocha -c test/spec`,
    ".test-cov": `nyc clap -q test-only`,
    "test-cov": {
      desc: "Use nyc to generate coverage for tests (add nyc config to your package.json)",
      task: () => {
        xarcModuleDev.setupCoverage();
        return ".test-cov";
      }
    },
    "add-typescript-deps": {
      desc: "Add dependencies for typescript support to your package.json",
      task: () => xarcModuleDev.addDevDeps("typescript")
    },
    "add-typedoc-deps": {
      desc: "Add dependencies for typedoc",
      task: () => xarcModuleDev.addDevDeps("typedoc")
    },
    "add-eslint-deps": {
      desc: "Add dependencies for eslint support to your package.json",
      task: () => xarcModuleDev.addDevDeps("eslint")
    },
    "rm-typescript-deps": {
      desc: "Remove dependencies for typescript support from your package.json",
      task: () => xarcModuleDev.rmDevDeps("typescript")
    },
    "rm-eslint-deps": {
      desc: "Remove dependencies for eslint support from your package.json",
      task: () => xarcModuleDev.rmDevDeps("eslint")
    }
  };

  /* if linting enable, then add eslint tasks */
  if (lint) {
    let eslintDir = Path.normalize(`${__dirname}/../config/eslint`);

    const customDir = Path.resolve("eslint");
    if (Fs.existsSync(customDir)) {
      eslintDir = customDir;
    }

    const lintTasks = {
      ".lint-src-ts": `eslint -c ${eslintDir}/.eslintrc-node-ts src --ext .ts,.tsx --color`,
      ".lint-src-js": `eslint -c ${eslintDir}/.eslintrc-node src --ext .js,.jsx --color`,
      ".lint-lib-ts": `eslint -c ${eslintDir}/.eslintrc-node-ts lib --ext .ts,.tsx --color`,
      ".lint-lib-js": `eslint -c ${eslintDir}/.eslintrc-node lib --ext .js,.jsx --color`,
      ".lint-test-ts": `eslint -c ${eslintDir}/.eslintrc-test-ts test/spec --ext .ts,.tsx --color`,
      ".lint-test-js": `eslint -c ${eslintDir}/.eslintrc-test test/spec --ext .js,.jsx --color`,
      lint: [invokeLint()]
    };

    Object.assign(tasks, lintTasks);
  } else {
    Object.assign(tasks, { lint: "echo linting is disabled by option enableLinting set to false" });
  }

  return tasks;
}

/**
 * Load XClap build tasks for developing node.js modules.
 *
 * See document for xclap at https://www.npmjs.com/package/xclap
 *
 * To use, create a file `xclap.js`:
 *
 * ```js
 *   require("@xarc/module-dev")()
 * ```
 *
 * or `xclap.ts` for typescript:
 *
 * ```ts
 *   import loadTasks from "@xarc/module-dev";
 *   loadTasks();
 * ```
 *
 * Then run the command `npx clap` to see available build tasks.
 *
 * @param xclapOrOptions options
 */
export function loadTasks(xclapOrOptions: object | XarcModuleDevOptions = { xclap }) {
  let options: XarcModuleDevOptions = xclapOrOptions;

  const cname = xclapOrOptions.constructor.name;
  if (cname === "XClap") {
    options = { xclap: xclapOrOptions };
  }

  setupPath();

  (options.xclap || xclap).load("xarc", makeTasks(options));
}

export { loadTasks as default };
