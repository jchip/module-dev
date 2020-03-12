"use strict";
const { loadTasks } = require("./dist/module-dev");
// commonjs happy
module.exports = (...args) => loadTasks(...args);
// esm happy
module.exports.default = loadTasks;
module.exports.loadTasks = loadTasks;
