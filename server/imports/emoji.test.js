import emojify from "./emoji.js";
import chai from "chai";

describe("emojify", function () {
  it("replaces multiple emoji", () =>
    chai.assert.equal(emojify(":wolf: in a :tophat:"), "🐺 in a 🎩"));

  it("ignores non-emoji", () =>
    chai.assert.equal(
      emojify(":fox_face: :capybara: :rabbit:"),
      "🦊 :capybara: 🐰",
    ));
});
