import chai from "chai";
import {
  selectionWithin,
  selectWithin,
  textContent,
} from "./contenteditable_selection.js";

describe("contentEditable", function () {
  /** @type HTMLDivElement */
  let editable;
  before(function () {
    editable = document.createElement("div");
    editable.contentEditable = "plaintext-only";
    document.documentElement.appendChild(editable);
  });
  afterEach(function () {
    editable.innerHTML = "";
  });
  after(function () {
    document.documentElement.removeChild(editable);
  });
  describe("selectionWithin", function () {
    describe("forward", function () {
      before(function () {
        editable.innerHTML = "some text  two spaces<br> after newline";
        document
          .getSelection()
          .setBaseAndExtent(editable.firstChild, 5, editable.lastChild, 8);
      });
      it("returns range", function () {
        chai.assert.deepEqual(selectionWithin(editable), [5, 30]);
      });
    });
    describe("backward", function () {
      before(function () {
        editable.innerHTML = "some text  two spaces<br> after newline";
        document
          .getSelection()
          .setBaseAndExtent(editable.lastChild, 8, editable.firstChild, 5);
      });
      it("returns range", function () {
        chai.assert.deepEqual(selectionWithin(editable), [5, 30]);
      });
    });
    describe("escaping element", function () {
      /** @type Node */
      let text;
      before(function () {
        editable.innerHTML = "some text  two spaces<br> after newline";
        text = document.createTextNode("after the contentEditable");
        document.documentElement.appendChild(text);
        document
          .getSelection()
          .setBaseAndExtent(editable.firstChild, 5, text, 5);
      });
      it("returns null", function () {
        chai.assert.isNotOk(selectionWithin(editable));
      });
      after(function () {
        document.documentElement.removeChild(text);
      });
    });
  });
  describe("selectWithin", function () {
    describe("forward", function () {
      before(function () {
        editable.innerHTML = "some text  two spaces<br> after newline";
        selectWithin(editable, 5, 30);
      });
      it("selected all three nodes", function () {
        const range = document.getSelection().getRangeAt(0);
        chai.assert.equal(
          range.startContainer,
          editable.firstChild,
          "startContainer"
        );
        chai.assert.equal(range.startOffset, 5, "startOffset");
        chai.assert.equal(
          range.endContainer,
          editable.lastChild,
          "endContainer"
        );
        chai.assert.equal(range.endOffset, 8, "endOffset");
      });
    });
    describe("backward", function () {
      before(function () {
        editable.innerHTML = "some text  two spaces<br> after newline";
        selectWithin(editable, 30, 5);
      });
      it("selected all three nodes", function () {
        const range = document.getSelection().getRangeAt(0);
        chai.assert.equal(
          range.startContainer,
          editable.firstChild,
          "startContainer"
        );
        chai.assert.equal(range.startOffset, 5, "startOffset");
        chai.assert.equal(
          range.endContainer,
          editable.lastChild,
          "endContainer"
        );
        chai.assert.equal(range.endOffset, 8, "endOffset");
      });
    });
    describe("caret", function () {
      before(function () {
        editable.innerHTML = "some text  two spaces<br> after newline";
        selectWithin(editable, 30);
      });
      it("selected one nodes", function () {
        const range = document.getSelection().getRangeAt(0);
        chai.assert.isTrue(range.collapsed, "collapsed");
        chai.assert.equal(
          range.startContainer,
          editable.lastChild,
          "startContainer"
        );
        chai.assert.equal(range.startOffset, 8, "startOffset");
        chai.assert.equal(
          range.endContainer,
          editable.lastChild,
          "endContainer"
        );
        chai.assert.equal(range.endOffset, 8, "endOffset");
      });
    });
    describe("illegal tag", function () {
      before(function () {
        editable.innerHTML = "can't have a <b>bold</b> tag";
      });
      it("throws an error", function () {
        chai.assert.throws(() => selectWithin(editable, 5, 18));
      });
    });
  });
  describe("textContent", function () {
    describe("with newline", function () {
      before(function () {
        editable.innerHTML = "some text  two spaces<br> after newline";
      });
      it("return correct value", function () {
        chai.assert.equal(
          textContent(editable),
          "some text  two spaces\n after newline"
        );
      });
    });
    describe("with rich text", function () {
      before(function () {
        editable.innerHTML = "can't have <b>bold</b> text";
      });
      it("throws an error", function () {
        chai.assert.throw(() => textContent(editable));
      });
    });
  });
});
