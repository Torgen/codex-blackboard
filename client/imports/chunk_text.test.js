import { chunk_text, chunk_html, plain_text } from "./chunk_text.js";
import chai from "chai";
import sinon from "sinon";
import { BBCollection } from "/lib/imports/collections.js";

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

  it("empty @ is plain text", () =>
    chai.assert.deepEqual(chunk_text("foo @ bar"), [
      { type: "text", content: "foo @ bar" },
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
    chai.assert.deepEqual(
      chunk_text(
        "First, http://www.foo.com/bar, and then also, http://www.baz.com/qux."
      ),
      [
        { type: "text", content: "First, " },
        {
          type: "url",
          content: {
            url: "http://www.foo.com/bar",
            original: "http://www.foo.com/bar",
          },
        },
        { type: "text", content: ", and then also, " },
        {
          type: "url",
          content: {
            url: "http://www.baz.com/qux",
            original: "http://www.baz.com/qux",
          },
        },
        { type: "text", content: "." },
      ]
    ));

  describe("room mentions", function () {
    it("matches puzzles", function () {
      chai.assert.deepEqual(chunk_text("join #puzzles/aB3dE6gH9jK12mN15, yo"), [
        { type: "text", content: "join " },
        { type: "room", content: { type: "puzzles", id: "aB3dE6gH9jK12mN15" } },
        { type: "text", content: ", yo" },
      ]);
    });
    it("matches rounds", function () {
      chai.assert.deepEqual(chunk_text("join #rounds/aB3dE6gH9jK12mN15, yo"), [
        { type: "text", content: "join " },
        { type: "room", content: { type: "rounds", id: "aB3dE6gH9jK12mN15" } },
        { type: "text", content: ", yo" },
      ]);
    });
    it("matches general", function () {
      chai.assert.deepEqual(chunk_text("join #general/0, yo"), [
        { type: "text", content: "join " },
        { type: "room", content: { type: "general", id: "0" } },
        { type: "text", content: ", yo" },
      ]);
    });
    it("ignores other", function () {
      chai.assert.deepEqual(chunk_text("join #other/aB3dE6gH9jK12mN15, yo"), [
        { type: "text", content: "join #other/aB3dE6gH9jK12mN15, yo" },
      ]);
    });
    it("separates from parenths", function () {
      chai.assert.deepEqual(chunk_text("(#puzzles/aB3dE6gH9jK12mN15)"), [
        { type: "text", content: "(" },
        { type: "room", content: { type: "puzzles", id: "aB3dE6gH9jK12mN15" } },
        { type: "text", content: ")" },
      ]);
    });
    it("leaves fragments with urls", function () {
      chai.assert.deepEqual(
        chunk_text("it's www.foo.com/bar#puzzles/aB3dE6gH9jK12mN15, yo"),
        [
          { type: "text", content: "it's " },
          {
            type: "url",
            content: {
              url: "http://www.foo.com/bar#puzzles/aB3dE6gH9jK12mN15",
              original: "www.foo.com/bar#puzzles/aB3dE6gH9jK12mN15",
            },
          },
          { type: "text", content: ", yo" },
        ]
      );
    });
  });
});

describe("plain_text", () => {
  before(function () {
    const puzzles = sinon.replace(
      BBCollection,
      "puzzles",
      new Mongo.Collection(null)
    );
    puzzles.insert({ _id: "sixteenletters16", name: "Mentioned Puzzle Name" });
  });
  after(function () {
    sinon.verifyAndRestore();
  });
  it("restores breaks", function () {
    chai.assert.equal(plain_text("foo\n\nbar"), "foo\n\nbar");
  });
  it("restores people mentions", function () {
    chai.assert.equal(
      plain_text("hello @foo, how are you?"),
      "hello @foo, how are you?"
    );
  });
  it("restores urls", function () {
    chai.assert.equal(
      plain_text("a link to www.foo.com/bar.gif in the chat"),
      "a link to http://www.foo.com/bar.gif in the chat"
    );
  });
  it("replaces room mentions", function () {
    chai.assert.equal(
      plain_text("go to #puzzles/sixteenletters16 and see if they need help"),
      "go to Mentioned Puzzle Name and see if they need help"
    );
  });
  it("restores nonexistent room mentions", function () {
    chai.assert.equal(
      plain_text("go to #puzzles/seventeenletters and see if they need help"),
      "go to #puzzles/seventeenletters and see if they need help"
    );
  });
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
