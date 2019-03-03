# Archetype: NodeJS Module (Development)

A Walmart Labs flavored NodeJS Module archetype.

## Installation

Within your project, run:

```sh
$ npm install --save-dev @xarc/module-dev
```

Add a `xclap.js` with the following code:

```js
require("@xarc/module-dev")();
```

Run `npx clap` to see a list of tasks.

### xclap-cli

A simple package [xclap-cli] is available for installing globally to get the `clap` command without `npx`.

```sh
$ npm install -g xclap-cli
```

## Project Structure

This archetype assumes a directory structure as follows:

```
.gitignore
package.json

lib/
  index.js

test/
  spec/**
    *.spec.js
```

[xclap-cli]: https://www.npmjs.com/package/xclap-cli
