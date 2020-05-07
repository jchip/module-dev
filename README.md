# Support for developing node.js modules with mocha/eslint/typescript

This module offers common config and setup for developing a node.js module.

Support for standard tools include:

- Language: [TypeScript]
- Testing and code coverage: [chai], [mocha], [nyc], [sinon]
- Code linting: [eslint]
- Documentation: [jsdoc], [typedoc]

## Installation

To start a new module, first create the directory for it:

```sh
mkdir my-module
cd my-module
```

Then follow the instructions below to setup development:

1. Within your new project dir, run:

```sh
npm init --yes
npm install --save-dev @xarc/module-dev
```

2. Bootstrap: then to bootstrap your project, use the following commands:

```sh
npx clap --require @xarc/module-dev init
npm install
```

- `init` takes the following options. ie: `npx clap --require @xarc/module-dev init --eslint`

  - `--no-typescript` - bootstrap without typescript support.
  - `--eslint` - bootstrap with eslint support.

3. Now you can run `npx clap` to see a list of build tasks available for developing your node.js module.

### xclap-cli

If you want to be able to run `clap` directly instead of having to do `npx clap`, then you can install globally a simple package [xclap-cli] with the following command.

```sh
$ npm install -g xclap-cli
```

## Project Structure

This module's setup assumes your project follows a directory structure like below:

```
.gitignore
package.json
tsconfig.json

lib/
  index.js

dist/
  index.js
  index.d.js
  index.js.map

src/
  index.ts

test/
  spec/**
    *.spec.js
    *.spec.ts
```

If you are writing JavaScript that node.js can execute directly, then you can put them in `lib` dir.

If you are using TypeScript, then you can put your `ts` source in `src` dir, and then run `npx tsc` to compile them into the `dist` dir.

`.d.ts` type definition files and source map files will also be generated into the `dist` dir.

## Developing

Once you start writing your code, either as [TypeScript] in `src` or JavaScript in `lib`, you should put your tests in the directory `test/spec` as `*.spec.js` or `*.spec.ts` files.

The following are common build tasks that you would use:

- Run linting and tests: `npx clap test`
- Run tests without linting: `npx clap test-only`
- Run linting and tests with coverage: `npx clap check`

Your [TypeScript] tests should import your TS code from `src` directly.

## Publishing

When you are ready to publish your module to [npm], please keep the following in mind:

This module automatically setup [files] in your `package.json` to include these files to publish:

- `lib` - If you have JavaScript in `lib` dir
- `dist` - If you are writing your code in [TypeScript].

For [TypeScript], your code from `src` directory is not included. If you want to include `src` dir, please add that to [files].

- If you have any other files or dirs that you want to publish, then add them to the `files` list.
- You can run `npm publish --dry-run` to see what [npm] will do without actually publishing for real.
- When you are ready to publish for real, you can run `npm publish`.

## [TypeScript] Support

If you boostrapped your project without [TypeScript], but then want to add it later, you can run the `typescript` build task any time:

```sh
npx clap typescript
npm install
mkdir src
```

And now you can start writing typescript code in the `src` directory

### tsconfig.json

After this module created `tsconfig.json` for you, you can change it as you like. This moudle won't override your settings.

## [eslint] Support

If you didn't bootstrap your project with [eslint] support, you can always add it later by running `npx clap eslint`, and then `npm install`.

You can also invoke the linting task with `npx clap lint`

The build task `check` will run linting also. You can invoke it with `npx clap check`.

If you need to disable certain eslint rules for a specific source file, you can add the following comment to the top of your file.

```js
/* eslint-disable no-console, no-magic-numbers, max-statements */
```

This comment disables the following three rules:

- `no-console`
- `no-magic-numbers`
- `max-statements`

## [jsdoc] linting

If you've enabled [eslint], then linting rules for [jsdoc] is added with the plugin [eslint-plugin-jsdoc].

## [typedoc] Support

If you've enabled [TypeScript], then [typedoc] is added to automatically generate HTML in `docs` from your [jsdoc] in your code in the `src` directory.

To generate the docs manually, run `npm run docs`. And then open `docs/index.html` to see the generated HTML docs.

### Fix [typedoc] externals

[typedoc] treats every filenames as a module and that doesn't work well with the practice of one class per file.

To customize modules for [typedoc], install the module `typedoc-plugin-external-module-name`.

Then in the `.ts` files:

- Use the following command to assign a file to a module.

```js
/**
 * @packageDocumentation
 * @module index
 */
```

- Use the following command to ignore a file:

```js
/** @ignore */ /** */
```

- Use the following command before any `export` to ignore it.

```js
/** @ignore */
export function internallySharedFunction() {}
```

## Compiling JSX

You can add JSX support by updating your `tsconfig.json` with following options:

```js
{
  compilerOptions: {
    "jsx": "react"
  }
}
```

### React

- To compile React JSX components:

1. Add [react] to your dependencies: `npm install react`

### Preact

- To compile Preact JSX components:

1. Add [preact] to your dependencies: `npm install preact`
2. Update `compilerOptions` in `tsconfig.json`:

```js
{
  "compilerOptions": {
    "lib": ["dom"],
    "jsxFactory": "h"
  }
}
```

## Additional Targets

If you need to compile your `src` to multiple targets, you can do this by:

1. Make a copy of `tsconfig.json` for your target. ie: `tsconfig.es5.json`
2. Add a `npm scripts` to run `tsc` with `--build` option. ie: `tsc --build tsconfig.es5.json`
3. Update `build` script to have `xclap` run your new compile script. So if you named it `compile.es5`, your `build` would be: `clap -n compile compile.es5`

- In your additional target config, you don't need `tsc` to generate the `.d.ts` files. You can turn it off by setting `declaration` to `false`

## License

Licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)

---

[xclap-cli]: https://www.npmjs.com/package/xclap-cli
[typescript]: https://www.typescriptlang.org/
[eslint]: https://eslint.org/
[mocha]: https://mochajs.org/
[chai]: https://www.chaijs.com/
[nyc]: https://istanbul.js.org/
[sinon]: https://sinonjs.org/
[jsdoc]: https://jsdoc.app/
[typedoc]: https://typedoc.org/
[eslint-plugin-jsdoc]: https://www.npmjs.com/package/eslint-plugin-jsdoc
[files]: https://docs.npmjs.com/files/package.json#files
[npm]: https://www.npmjs.com/
[react]: https://reactjs.org/
[preact]: https://preactjs.com/
