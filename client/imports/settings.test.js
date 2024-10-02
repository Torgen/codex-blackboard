import chai from "chai";
import { ICONS_ONLY, NICKNAMES_ONLY, WHOS_WORKING_STYLE } from "./settings.js";

describe("per-browser settings", function () {
  describe("EnumSetting", function () {
    it("rejects non-enum values", function () {
      chai.assert.throws(() => WHOS_WORKING_STYLE.set("not-in-the-enum"));
      chai.assert.notEqual(
        "not-in-the-enum",
        localStorage.getItem(WHOS_WORKING_STYLE.name)
      );
    });
    it("accepts enum values", function () {
      WHOS_WORKING_STYLE.set(NICKNAMES_ONLY);
      chai.assert.equal(
        NICKNAMES_ONLY,
        localStorage.getItem(WHOS_WORKING_STYLE.name)
      );
    });
    it("returns from local storage", function () {
      localStorage.setItem(WHOS_WORKING_STYLE.name, "not in the enum");
      chai.assert.equal("not in the enum", WHOS_WORKING_STYLE.get());
    });
    it("returns default value", function () {
      localStorage.removeItem(WHOS_WORKING_STYLE.name);
      chai.assert.equal(ICONS_ONLY, WHOS_WORKING_STYLE.get());
    });
  });
});
