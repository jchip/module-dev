import Path from "path";
export * from "./module-dev";
export { loadTasks as default } from "./module-dev";

export const eslintRcNode = Path.posix.join(__dirname, "../config/eslint/.eslintrc-node");
export const eslintRcNodeTypeScript = Path.posix.join(
  __dirname,
  "../config/eslint/.eslintrc-node-ts"
);
export const eslintRcTest = Path.posix.join(__dirname, "../config/eslint/.eslintrc-test");
export const eslintRcTestTypeScript = Path.posix.join(
  __dirname,
  "../config/eslint/.eslintrc-test-ts"
);
