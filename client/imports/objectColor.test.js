import objectColor, { cssColorToHex, hexToCssColor } from "./objectColor.js";
import chai from "chai";

describe("objectColor", function () {
  it("copies color from tag", function () {
    const obj = {
      _id: "foo",
      tags: {
        color: {
          value: "aliceblue",
        },
      },
    };
    chai.assert.equal(objectColor(obj), "aliceblue");
  });

  return it("generates hsl from _id", function () {
    const obj = { _id: "u8JniQ2zqueSykCTm" };
    chai.assert.equal(
      objectColor(obj),
      "hsl(48, 82.60465732490333%, 20.291986247835695%)",
    );
  });
});

describe("cssColorToHex", function () {
  it("converts three-hex to six-hex", () =>
    chai.assert.equal(cssColorToHex("#fa7"), "#ffaa77"));

  it("leaves six-hex alone", () =>
    chai.assert.equal(cssColorToHex("#f2a67c"), "#f2a67c"));

  it("converts named colors", function () {
    chai.assert.equal(cssColorToHex("rebeccapurple"), "#663399");
    chai.assert.equal(cssColorToHex("lime"), "#00ff00");
    chai.assert.equal(cssColorToHex("burlywood"), "#deb887");
  });

  it("converts hsl", function () {
    chai.assert.equal(cssColorToHex("hsl(120,100%,50%)"), "#00ff00");
    chai.assert.equal(cssColorToHex("hsl(30, 100%, 50%)"), "#ff8000");
  });
});

describe("hexToCssColor", function () {
  it("converts named colors", function () {
    chai.assert.equal(hexToCssColor("#663399"), "rebeccapurple");
    chai.assert.equal(hexToCssColor("#f0f8ff"), "aliceblue");
    chai.assert.equal(hexToCssColor("#00ff00"), "lime");
  });

  it("leaves unknown colors", function () {
    chai.assert.equal(hexToCssColor("#66339a"), "#66339a");
    chai.assert.equal(hexToCssColor("#f0f8fe"), "#f0f8fe");
    chai.assert.equal(hexToCssColor("#00ff0b"), "#00ff0b");
  });
});
