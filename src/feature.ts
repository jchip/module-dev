import * as _ from "lodash";
import { sortObjKeys } from "./utils";

export class Feature {
  _name: string;
  _deps: Record<string, any>;
  _devDeps: Record<string, any>;
  _setup: Function;
  _remove: Function;

  constructor({
    name,
    deps = {},
    devDeps = {},
    setup = _.noop,
    remove = _.noop
  }: {
    name: string;
    deps?: Record<string, any>;
    devDeps?: Record<string, any>;
    setup?: Function;
    remove?: Function;
    depFeatures?: string[];
  }) {
    this._name = name;
    this._deps = deps;
    this._devDeps = devDeps;
    this._setup = setup;
    this._remove = remove;
  }

  finishRemove() {
    this._remove();
  }

  finishUpdate() {
    this._setup();
  }

  update(pkg: Record<string, any>, deps: Record<string, any>, section: string) {
    const target = _.get(pkg, section, {});
    for (const k in deps) {
      target[k] = deps[k];
    }
    if (!_.isEmpty(target)) {
      _.set(pkg, section, sortObjKeys(target));
    }
  }

  updateToPkg(pkg: Record<string, any>) {
    this.update(pkg, this._deps, "dependencies");
    this.update(pkg, this._devDeps, "devDependencies");
  }

  remove(pkg: Record<string, any>, deps: Record<string, any>, section: string) {
    const target = _.get(pkg, section, {});
    for (const k in deps) {
      delete target[k];
    }
    if (_.isEmpty(target)) {
      delete pkg[section];
    } else {
      _.set(pkg, section, sortObjKeys(target));
    }
  }

  removeFromPkg(pkg: Record<string, any>) {
    this.remove(pkg, this._deps, "dependencies");
    this.remove(pkg, this._devDeps, "devDependencies");
  }

  check(deps: Record<string, any>, target = {}): boolean {
    return Object.keys(deps).every(x => {
      return target.hasOwnProperty(x);
    });
  }

  checkPkg(pkg: Record<string, any>): boolean {
    return (
      this.check(this._deps, pkg.dependencies || {}) &&
      this.check(this._devDeps, pkg.devDependencies || {})
    );
  }
}
