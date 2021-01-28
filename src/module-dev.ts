/* eslint-disable no-console, global-require, no-magic-numbers, max-statements, consistent-return, complexity*/
import * as Path from "path";
import * as xsh from "xsh";
import * as Fs from "fs";
import * as xrun from "@xarc/run";
import * as _ from "lodash";
import { Feature } from "./feature";

import { loadSync } from "tsconfig";

/**
 * User configurable options for @xarc/module-dev tasks
 */
export type XarcModuleDevOptions = {
  /** force terminal colors in output - *default* `true` */
  forceColor?: boolean;
  /** Specify a XRun instance to use - *default* `require("@xarc/npm-run")` */
  xrun?: any; // type not available yet
  /** alternative for xrun (for backward compat only, do not use in new code) */
  xclap?: any;
  /** turn off/on linting tasks (using eslint) - *default* `true` */
  enableLinting?: boolean;
  /** Specify typescript config to override the default one */
  tsConfig?: Record<string, any>;
  /**
   * Specify the directories that are considered to contain your source code.
   * - Mainly used for eslint to look for code to run lint on.
   * - If this option is not specified then package.json["@xarc/run"].srcDir is checked.
   * - Default: `["src", "lib", "test"]`
   * - "lib" is removed from default if tsconfig.json:compilerOptions.outDir is "lib"
   * - The eslint rules used is configured for node.js unless the dirname contains the string "test",
   *   then a eslint config for testing code is used.  (with rules for describe, it etc)
   */
  srcDir?: string[];
};

/**
 * setup PATH
 */
function setupPath(): void {
  xsh.envPath.addToFront(Path.resolve("node_modules/.bin"));
  xsh.envPath.addToFront(Path.join(__dirname, "../node_modules/.bin"));
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
function writeAppPkgJson(pkg: Record<string, any>): void {
  const data = JSON.stringify(pkg, null, 2);
  Fs.writeFileSync(Path.resolve("package.json"), `${data}\n`);
}

class XarcModuleDev {
  _appPkg: Record<string, any>;
  _myPkg: Record<string, any>;
  _existFeatures: string[];
  _features: string[];
  _removedFeatures: string[];
  _changedFeatures: string[];
  _depsChanges: string[];
  _availableFeatures: Record<string, Feature>;
  _existAppPkgData: string;
  _tsConfig: Record<string, any>;
  _actionRecords: string[];

  get hasEslint(): boolean {
    return this.hasFeature("eslint");
  }

  get hasTypedoc(): boolean {
    return this.hasFeature("typedoc");
  }

  get hasTypescript(): boolean {
    return this.hasFeature("typescript");
  }

  get hasMocha(): boolean {
    return this.hasFeature("mocha");
  }

  get hasTap(): boolean {
    return this.hasFeature("tap");
  }

  constructor(options: XarcModuleDevOptions) {
    this._myPkg = JSON.parse(Fs.readFileSync(Path.join(__dirname, "../package.json")).toString());
    this.setupAvailableFeatures();
    this.loadAppPkg();
    this._features = this._existFeatures;
    this._removedFeatures = [];
    this._changedFeatures = [];
    this._depsChanges = [];
    this._actionRecords = [];
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
    this._tsConfig = options.tsConfig || defaultTsConfig;
  }

  setupAvailableFeatures() {
    const featuresDep = JSON.parse(
      Fs.readFileSync(Path.join(__dirname, "../config/features-deps.json")).toString()
    );

    const typedocFeature = new Feature({
      name: "typedoc",
      ...featuresDep.typedoc,
      setup: () => {
        this.setupTypedocScripts();
      }
    });

    const typescriptFeature = new Feature({
      name: "typescript",
      ...featuresDep.typescript,
      setup: () => {
        this.setupCompileScripts();
        this.setupTsConfig();
      }
    });

    const eslintFeature = new Feature({
      name: "eslint",
      ...featuresDep.eslint
    });

    const eslintTSFeature = new Feature({
      name: "eslint-ts",
      ...featuresDep["eslint-ts"]
    });

    const mochaFeature = new Feature({
      name: "mocha",
      ...featuresDep.mocha,
      setup: () => {
        this.setupMochaConfig();
        this.setupCoverage();
      },
      remove: () => this.removeMochaConfig()
    });

    const tapFeature = new Feature({
      name: "tap",
      ...featuresDep.tap,
      setup: () => {
        this.setupTapConfig();
      },
      remove: () => this.removeTapConfig()
    });

    this._availableFeatures = {
      typedoc: typedocFeature,
      typescript: typescriptFeature,
      eslint: eslintFeature,
      eslintTS: eslintTSFeature,
      mocha: mochaFeature,
      tap: tapFeature
    };
  }

  recordAction(msg: string) {
    this._actionRecords.push(msg);
  }

  loadAppPkg() {
    this._appPkg = readAppPkgJson();
    this._existAppPkgData = JSON.stringify(this._appPkg);
    const fromDeps = this.updateFeaturesFromDeps();
    this._existFeatures = _.uniq(
      Object.keys(fromDeps)
        .filter(k => fromDeps[k])
        .concat(_.get(this._appPkg, [this._myPkg.name, "features"], []))
        .filter(_.identity)
    ).sort();
  }

  updateFeaturesFromDeps() {
    const af = this._availableFeatures;
    return {
      eslint: af.eslint.checkPkg(this._appPkg),
      typescript: af.typescript.checkPkg(this._appPkg),
      typedoc: af.typedoc.checkPkg(this._appPkg),
      mocha: af.mocha.checkPkg(this._appPkg),
      tap: af.tap.checkPkg(this._appPkg)
    };
  }

  setupXrunFile() {
    const saveFile = (name, content) => {
      if (!Fs.existsSync(name)) {
        Fs.writeFileSync(name, content);
      }
    };

    if (this.hasTypescript) {
      saveFile(
        Path.resolve("xrun-tasks.ts"),
        `import { loadTasks } from "@xarc/module-dev";
loadTasks();
`
      );
    } else {
      saveFile(
        Path.resolve("xrun-tasks.js"),
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
      this.recordAction("INFO: created .gitignore file for you.");
    }
  }

  addFeatures(...features: string[]) {
    let newFeatures = [].concat(this._features, features);

    // if eslint and typescript are enabled, then needs eslintTS
    if (newFeatures.includes("typescript") && newFeatures.includes("eslint")) {
      newFeatures.push("eslintTS");
    }

    // if typedoc enabled, then needs typescript
    if (newFeatures.includes("typedoc")) {
      newFeatures.push("typescript");
    }

    newFeatures = _.uniq(newFeatures);

    for (const f of newFeatures) {
      if (!this._features.includes(f)) {
        this._availableFeatures[f].updateToPkg(this._appPkg);
        this._changedFeatures.push(f);
        this.recordAction(`INFO: added support for ${f}`);
      }
    }

    this.updateFeatures(newFeatures);

    if (this.appPkgChanged()) {
      this._depsChanges = this._depsChanges.concat(this._changedFeatures);
    }
  }

  hasFeature(feature: string): boolean {
    return this._features.includes(feature);
  }

  updateFeatures(features: string[]) {
    this._features = _.uniq(features.sort());
  }

  removeFeatures(...features: string[]) {
    let newFeatures = _.uniq(_.without(this._features, ...features));
    let removing = [].concat(features);
    // if eslint or typescript are removed, then need to remove eslintTS
    if (!newFeatures.includes("typescript") || !newFeatures.includes("eslint")) {
      removing.push("eslintTS");
    }

    // if typescript removed, then need to remove typedoc
    if (!newFeatures.includes("typescript")) {
      removing.push("typedoc");
    }
    removing = _.uniq(removing);
    // update new features with other dependent features that's removed
    newFeatures = _.without(newFeatures, ...removing);

    for (const f of removing) {
      if (this._features.includes(f)) {
        this._removedFeatures.push(f);
        this._availableFeatures[f].removeFromPkg(this._appPkg);
        this.recordAction(`INFO: removed support for ${f}`);
      }
    }

    this.updateFeatures(newFeatures);

    if (this.appPkgChanged()) {
      this._depsChanges = this._depsChanges.concat(this._removedFeatures);
    }
  }

  appPkgChanged(): boolean {
    const newData = JSON.stringify(this._appPkg);
    return this._existAppPkgData !== newData;
  }

  saveAppPkgJson(): boolean {
    const newData = JSON.stringify(this._appPkg);
    if (this._existAppPkgData !== newData) {
      this._existAppPkgData = newData;
      writeAppPkgJson(this._appPkg);
      return true;
    }
    return false;
  }

  appHasDevDeps(...deps: string[]): boolean {
    return deps.every(x => {
      const dd = this._appPkg.devDependencies;
      return dd && dd.hasOwnProperty(x);
    });
  }

  setupTsConfig(): void {
    if (!this.hasTypescript) {
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
    const finalTsConfig = _.merge({}, this._tsConfig, tsConfig);
    if (JSON.stringify(finalTsConfig) !== existData) {
      Fs.writeFileSync(file, `${JSON.stringify(finalTsConfig, null, 2)}\n`);
      this.recordAction("INFO: updated tsconfig.json for you.  Please commit it");
    }
  }

  setupPublishingConfig(): void {
    const files = this._appPkg.files || [];

    if (this.hasTypescript) {
      files.push("dist");
    }

    if (Fs.existsSync(Path.resolve("lib"))) {
      files.push("lib");
    }

    this._appPkg.files = _.uniq(files).sort();
    if (this.appPkgChanged()) {
      this.recordAction(`INFO: updated files in your package.json for publishing.`);
    }
  }

  setupCompileScripts(): void {
    if (!this.hasTypescript) {
      return;
    }
    const scripts = this._appPkg.scripts || {};
    this._appPkg.scripts = scripts;
    const prepublishTasks = ["build"];
    if (this.hasTypedoc) {
      prepublishTasks.push("docs");
    }
    this._appPkg.scripts = {
      build: "tsc",
      ...scripts,
      prepublishOnly: `xrun [[${prepublishTasks.join(", ")}], xarc/check]`
    };
    if (this.appPkgChanged()) {
      this.recordAction(`INFO: added npm scripts for your typescript and release lifecycle.`);
    }
  }

  setupTypedocScripts(): void {
    if (!this.hasTypedoc) {
      return;
    }
    this.updateFeaturesFromDeps();
    const scripts = this._appPkg.scripts || {};
    this._appPkg.scripts = scripts;
    _.defaults(scripts, {
      docs: `xrun xarc/docs`
    });
  }

  setupTapConfig(): void {
    const tapOpts = this._appPkg.tap || {};
    this._appPkg.tap = tapOpts;

    this._appPkg.scripts = {
      ...this._appPkg.scripts,
      test: "xrun xarc/test-only",
      coverage: "xrun xarc/test-cov"
    };

    tapOpts.ts ??= false;
    tapOpts["test-regex"] ??= "(^test\/spec\/.*)\.([mc]js|[jt]sx?)";

    // coverage enforcement options
    tapOpts["check-coverage"] ??= true;
    tapOpts.branches ??= 100;
    tapOpts.functions ??= 100;
    tapOpts.lines ??= 100;
    tapOpts.statements ??= 100;

    const tsNodeReg = "ts-node/register";
    const sourceMapReg = "source-map-support/register";
    const nodeArgs = tapOpts["node-arg"] || [];

    if (this.appHasDevDeps("ts-node") && nodeArgs.indexOf(tsNodeReg) === -1) {
      nodeArgs.push("-r", tsNodeReg);
    }

    if (this.appHasDevDeps("source-map-support") && nodeArgs.indexOf(sourceMapReg) === -1) {
      nodeArgs.push("-r", sourceMapReg);
    }

    tapOpts["node-arg"] = nodeArgs;

    if (this.appPkgChanged()) {
      this.recordAction(`INFO: updated tap options in your package.json.`);
    }
  }

  setupMochaConfig(): void {
    const mochaOpts = this._appPkg.mocha || {};
    this._appPkg.mocha = mochaOpts;

    this._appPkg.scripts = {
      ...this._appPkg.scripts,
      test: "xrun xarc/test-only",
      coverage: "xrun xarc/test-cov"
    };

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

    if (this.appPkgChanged()) {
      this.recordAction(`INFO: updated mocha options in your package.json.`);
    }
  }

  removeMochaConfig(): void {
    delete this._appPkg.mocha;
    if (this.appPkgChanged()) {
      this.recordAction(`INFO: removed mocha config from your package.json`);
    }
  }

  removeTapConfig(): void {
    delete this._appPkg.tap;
    if (this.appPkgChanged()) {
      this.recordAction(`INFO: removed tap config from your package.json`);
    }
  }

  setupCoverage(): void {
    const nyc = this._appPkg.nyc || {};

    const nycConfigTs = "@istanbuljs/nyc-config-typescript";
    const nycExtends = _.without(nyc.extends || [], nycConfigTs);
    if (this.hasTypescript) {
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
      cache: !this.hasTypescript
    });
    nyc.reporter = _.uniq(nyc.reporter.concat(["lcov", "text", "text-summary"]).sort());
    nyc.exclude = _.uniq(
      nyc.exclude
        .concat([
          "coverage",
          "docs",
          "xrun*.js",
          "xrun*.ts",
          "*clap.js",
          "*clap.ts",
          "gulpfile.js",
          "dist",
          "test"
        ])
        .sort()
    );
    this._appPkg.nyc = nyc;
    if (this.appPkgChanged()) {
      this.recordAction("INFO: updated nyc config in your package.json. Please commit it.");
    }
  }

  finish() {
    for (const f of this._removedFeatures) {
      this._availableFeatures[f].finishRemove();
    }

    for (const f of this._changedFeatures) {
      this._availableFeatures[f].finishUpdate();
    }

    _.set(this._appPkg, [this._myPkg.name, "features"], this._features);

    if (this.saveAppPkgJson()) {
      if (this._depsChanges.length > 0) {
        this.recordAction(
          `INFO: dependencies changed by these features: ${this._depsChanges.join(", ")}`
        );
        this.recordAction(
          "INFO: Please run 'npm install' (or with your preferred package manager)"
        );
      }
      this.recordAction("INFO: Your package.json has been updated.  Please commit it.");
    }

    if (this._actionRecords.length > 0) {
      console.log(this._actionRecords.join("\n"));
    }
  }
}

/**
 * Make XRun build tasks
 *
 * @param options options
 * @returns tasks
 */
function makeTasks(options: XarcModuleDevOptions) {
  if (options.forceColor !== false) {
    process.env.FORCE_COLOR = "true";
  }

  const { concurrent } = options.xrun || options.xclap;

  const xarcModuleDev = new XarcModuleDev(options);

  const updateFeature = (remove = false, ...features: string[]) => {
    if (remove) {
      xarcModuleDev.removeFeatures(...features);
    } else {
      xarcModuleDev.addFeatures(...features);
    }
  };

  const lint = options.enableLinting !== false && xarcModuleDev.hasFeature("eslint");

  const invokeLint = () => {
    if (!lint) {
      return [];
    }

    const tsconfig = loadSync(process.cwd());

    const outDir = _.get(tsconfig, "config.compilerOptions.outDir");

    const srcDir =
      options.srcDir ||
      _.get(
        xarcModuleDev,
        ["_appPkg", xarcModuleDev._myPkg.name, "srcDir"],
        [outDir !== "lib" && "lib", "src", "test"]
      );

    const dirs = [].concat(srcDir).join(" ");
    return [`~$eslint --ext .js,.jsx,.ts,.tsx --color --no-error-on-unmatched-pattern ${dirs}`];
  };

  const tasks = {
    test: ["lint", "test-only"],
    check: ["lint", "test-cov"],
    docs: {
      desc: "Generate docs from typedoc comments",
      async task() {
        const { stdout } = await xsh.exec("git rev-list -1 HEAD src", true);
        const commitId = stdout
          .split("\n")[0]
          .trim()
          .substr(0, 8);

        return xrun.exec(`typedoc --gitRevision ${commitId} --out docs src`, {
          flags: "tty"
        });
      }
    },
    typescript: {
      desc: `Add/remove config and deps to your project for typescript support:
        options: --remove to remove`,
      task(context) {
        updateFeature(context.argOpts.remove, "typescript");
        xarcModuleDev.finish();
      },
      argOpts: { remove: { type: "boolean" } }
    },
    typedoc: {
      desc: `Add/remove support to your project for generating API docs using typedoc
          Options: --remove to remove`,
      task(context) {
        updateFeature(context.argOpts.remove, "typedoc");
        xarcModuleDev.finish();
      },
      argOpts: { remove: { type: "boolean" } }
    },
    eslint: {
      desc: `Add/remove config and deps to your project for eslint support
          Options: --remove to remove`,
      task(context) {
        updateFeature(context.argOpts.remove, "eslint");
        xarcModuleDev.finish();
      },
      argOpts: { remove: { type: "boolean" } }
    },
    mocha: {
      desc: `Add/remove config and deps to your project for mocha/sinon support
          Options: --remove to remove`,
      task(context) {
        updateFeature(context.argOpts.remove, "mocha");
        xarcModuleDev.finish();
      },
      argOpts: { remove: { type: "boolean" } }
    },
    tap: {
      desc: `Add/remove config and deps to your project for tap support
          Options: --remove to remove`,
      task(context) {
        updateFeature(context.argOpts.remove, "tap");
        xarcModuleDev.finish();
      },
      argOpts: { remove: { type: "boolean" } }
    },
    init: {
      desc: `Bootstrap a project for development with @xarc/module-dev
          Options: --no-typescript --no-typedoc --no-tap --eslint --mocha`,
      argOpts: {
        tap: { type: "boolean", default: true },
        typescript: { type: "boolean", default: true },
        typedoc: { type: "boolean", default: true },
        mocha: { type: "boolean", default: false },
        eslint: { type: "boolean", default: false }
      },
      task(context) {
        const xtra = _.without(
          Object.keys(context.argOpts),
          "tap",
          "typescript",
          "eslint",
          "typedoc",
          "mocha"
        );
        if (xtra.length > 0) {
          throw new Error(`Unknown options for init task ${xtra.join(", ")}`);
        }

        const features: string[] = [];
        if (context.argOpts.typescript) {
          features.push("typescript");
        }
        if (context.argOpts.eslint) {
          features.push("eslint");
        }
        if (context.argOpts.typedoc) {
          features.push("typedoc");
        }
        if (context.argOpts.mocha) {
          features.push("mocha");
        }
        if (context.argOpts.tap) {
          features.push("tap");
        }
        xarcModuleDev.loadAppPkg();
        updateFeature(false, ...features);
        xarcModuleDev.setupXrunFile();
        xarcModuleDev.setupPublishingConfig();
        xarcModuleDev.setupGitIgnore();
        xarcModuleDev.finish();
      }
    },
    "test-only": {
      desc: "Run just your unit tests (no coverage)",
      task() {
        if (xarcModuleDev.hasMocha) {
          return xsh.exec(`mocha --extension ts,js,tsx,jsx,cjs,mjs -c test/spec`);
        } else if (xarcModuleDev.hasTap) {
          return xsh.exec(`tap --no-coverage`);
        } else {
          console.log("No Test Framework setup: Please add tap/mocha using npx xrun mocha|tap");
        }
      }
    },
    "test-cov": {
      desc: "Run your unit tests with coverage",
      task() {
        if (xarcModuleDev.hasMocha) {
          return xsh.exec(`nyc xrun -q test-only`);
        } else if (xarcModuleDev.hasTap) {
          return xsh.exec(`tap`);
        } else {
          console.log("No Test Framework setup: Please add tap/mocha using npx xrun mocha|tap");
        }
      }
    }
  };

  /* if linting enable, then add eslint tasks */
  if (lint) {
    const lintTasks = invokeLint();

    if (lintTasks.length > 0) {
      Object.assign(tasks, {
        lint: concurrent(...lintTasks)
      });
    }
  } else if (options.enableLinting === false) {
    Object.assign(tasks, {
      lint: "echo linting is disabled by option enableLinting set to false in your xrun tasks file."
    });
  } else {
    Object.assign(tasks, {
      lint: `echo linting is disabled because eslint is not setup.  Run 'npx xrun eslint' to setup.`
    });
  }

  return tasks;
}

/**
 * Load @xarc/npm-run build tasks for developing node.js modules.
 *
 * See document for @xarc/npm-run at https://www.npmjs.com/package/@xarc/npm-run
 *
 * To use, create a file `xrun-tasks.js`:
 *
 * ```js
 *   require("@xarc/module-dev")()
 * ```
 *
 * or `xrun-tasks.ts` for typescript:
 *
 * ```ts
 *   import loadTasks from "@xarc/module-dev";
 *   loadTasks();
 * ```
 *
 * Then run the command `npx xrun` to see available build tasks.
 *
 * @param xrunOrOptions options
 *
 * @returns xrun - the instance of `@xarc/run` used to load tasks.
 *
 */
export function loadTasks(
  xrunOrOptions: Record<string, any> | XarcModuleDevOptions = { xrun }
): any {
  let options: XarcModuleDevOptions = xrunOrOptions;

  const cname = xrunOrOptions.constructor.name;
  if (cname === "XClap" || cname === "XRun") {
    options = { xrun: xrunOrOptions };
  } else if (!options.xclap && !options.xrun) {
    options = { ...options, xrun };
  }

  setupPath();

  const xrunInst: any = options.xrun || options.xclap;
  xrunInst.load("xarc", makeTasks(options), -10);

  return xrunInst;
}

export { loadTasks as default, xrun };
