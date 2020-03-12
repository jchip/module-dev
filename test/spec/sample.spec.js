const moduleDev = require("../..");

describe("sample", function() {
  it("should load tasks function", () => {
    expect(moduleDev).to.be.a("function");
  });
});
