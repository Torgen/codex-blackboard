import { hsize } from "./splitter.js";
import { login, logout } from "/client/imports/app_test_helpers.js";
import chai from "chai";

describe("splitter", function () {
  before(() => login("testy", "Teresa Tybalt", "", "failphrase"));

  after(() => logout());

  it("resizes", function () {
    chai.assert.equal(hsize(), 300, "initial");
    $(".bb-splitter > .bb-splitter-handle").trigger(
      $.Event(new MouseEvent("mousedown"), { pageX: 900 })
    );
    chai.assert.isTrue($(".bb-splitter").hasClass("active"), "active");
    $(document).trigger($.Event(new MouseEvent("mousemove"), { pageX: 800 }));
    chai.assert.equal(hsize(), 400, "dragging");
    $(document).trigger($.Event(new MouseEvent("mouseup"), { pageX: 800 }));
    chai.assert.equal(hsize(), 400, "released");
    chai.assert.isFalse($(".bb-splitter").hasClass("active"), "inactive");
  });
});
