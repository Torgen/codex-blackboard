import { chunk_text, chunk_html } from "./chunk_text.js";
import chai from "chai";

describe("chunk_text", function () {
  it("inserts newline before mention", () =>
    chai.assert.deepEqual(chunk_text("@foo: do x\n@bar: do y"), [
      { type: "mention", content: "foo" },
      { type: "text", content: ": do x" },
      { type: "break", content: "" },
      { type: "mention", content: "bar" },
      { type: "text", content: ": do y" },
    ]));

  it("supports mention characters", () =>
    chai.assert.deepEqual(chunk_text("@test_1x: yo"), [
      { type: "mention", content: "test_1x" },
      { type: "text", content: ": yo" },
    ]));

  it("matches urls without protocol", () =>
    chai.assert.deepEqual(chunk_text("it's www.foo.com/bar, yo"), [
      { type: "text", content: "it's " },
      {
        type: "url",
        content: { url: "http://www.foo.com/bar", original: "www.foo.com/bar" },
      },
      { type: "text", content: ", yo" },
    ]));

    it("matches two url", () =>
      chai.assert.deepEqual(chunk_text("First, http://www.foo.com/bar, and then also, http://www.baz.com/qux."), [
        { type: "text", content: "First, " },
        {
          type: "url",
          content: { url: "http://www.foo.com/bar", original: "http://www.foo.com/bar" },
        },
        { type: "text", content: ", and then also, " },
        {
          type: "url",
          content: { url: "http://www.baz.com/qux", original: "http://www.baz.com/qux" },
        },
        { type: "text", content: "." },
      ]));
});

describe("chunk_html", () =>
  it("processes text outside tags", () =>
    chai.assert.deepEqual(
      chunk_html(
        '@torgen: there\'s already <i class="fas fa-link"></i><a href="foo">a puzzle named bar</a>.'
      ),
      [
        { type: "mention", content: "torgen" },
        { type: "text", content: ": there's already " },
        {
          type: "html",
          content:
            '<i class="fas fa-link"></i><a href="foo">a puzzle named bar</a>',
        },
        { type: "text", content: "." },
      ]
    )));
