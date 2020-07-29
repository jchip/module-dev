import { loadTasks } from "../../src/module-dev";
import { expect } from "chai";
import { it, describe } from "mocha";
describe("sample", () => {
  it("should load tasks function", () => {
    expect(loadTasks).to.be.a("function");
  });
});
