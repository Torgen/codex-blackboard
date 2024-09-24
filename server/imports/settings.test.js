import settings from "/lib/imports/settings.js";
import { callAs, impersonating } from "./impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { assertRejects, clearCollections } from "/lib/imports/testutils.js";

describe("settings", function () {
  let clock = null;

  beforeEach(async function () {
    await clearCollections(settings.Settings);
    clock = sinon.useFakeTimers({
      now: 4,
      toFake: ["Date"],
    });
    for (let canon in settings.all_settings) {
      const setting = settings.all_settings[canon];
      await setting.ensure();
    }
    clock.tick(3);
  });

  afterEach(() => clock.restore());

  describe("set", function () {
    it("fails without login", async function () {
      await assertRejects(settings.EmbedPuzzles.set(false), Match.Error);
    });

    it("sets default", async function () {
      chai.assert.deepEqual(
        await settings.Settings.findOneAsync("embed_puzzles"),
        {
          _id: "embed_puzzles",
          value: true,
          touched: 4,
        }
      );
    });

    describe("of boolean", function () {
      [false, true].forEach(function (b) {
        it(`allows boolean ${b}`, async function () {
          await impersonating("torgen", () => settings.EmbedPuzzles.set(b));
          chai.assert.deepEqual(
            await settings.Settings.findOneAsync("embed_puzzles"),
            {
              _id: "embed_puzzles",
              value: b,
              touched: 7,
              touched_by: "torgen",
            }
          );
        });

        it(`allows string ${b}`, async function () {
          await impersonating("torgen", () =>
            settings.EmbedPuzzles.set(`${b}`)
          );
          chai.assert.deepEqual(
            await settings.Settings.findOneAsync("embed_puzzles"),
            {
              _id: "embed_puzzles",
              value: b,
              touched: 7,
              touched_by: "torgen",
            }
          );
        });
      });

      it("fails on non-boolean", async function () {
        await assertRejects(
          impersonating("torgen", () => settings.EmbedPuzzles.set("something")),
          Match.Error
        );
      });
    });

    describe("of url", function () {
      ["http", "https"].forEach((protocol) =>
        it(`allows protocol ${protocol}`, async function () {
          const url = `${protocol}://molasses.holiday`;
          await impersonating("torgen", () =>
            settings.PuzzleUrlPrefix.set(url)
          );
          chai.assert.deepEqual(
            await settings.Settings.findOneAsync("puzzle_url_prefix"),
            {
              _id: "puzzle_url_prefix",
              value: url,
              touched: 7,
              touched_by: "torgen",
            }
          );
        })
      );

      it("disallows ftp", async function () {
        await assertRejects(
          impersonating("torgen", () =>
            settings.PuzzleUrlPrefix.set("ftp://log:pwd@molasses.holiday")
          ),
          Match.Error
        );
      });
    });

    describe("of int", function () {
      it("allows integer", async function () {
        await impersonating("torgen", () =>
          settings.MaximumMemeLength.set(925)
        );
        chai.assert.deepEqual(
          await settings.Settings.findOneAsync("maximum_meme_length"),
          {
            _id: "maximum_meme_length",
            value: 925,
            touched: 7,
            touched_by: "torgen",
          }
        );
      });

      it("allows string of integer", async function () {
        await impersonating("torgen", () =>
          settings.MaximumMemeLength.set("633")
        );
        chai.assert.deepEqual(
          await settings.Settings.findOneAsync("maximum_meme_length"),
          {
            _id: "maximum_meme_length",
            value: 633,
            touched: 7,
            touched_by: "torgen",
          }
        );
      });

      it("allows string of integral float", async function () {
        await impersonating("torgen", () =>
          settings.MaximumMemeLength.set("286.99")
        );
        chai.assert.deepEqual(
          await settings.Settings.findOneAsync("maximum_meme_length"),
          {
            _id: "maximum_meme_length",
            value: 286,
            touched: 7,
            touched_by: "torgen",
          }
        );
      });
    });

    describe("of path component", function () {
      const uuid = "469a2d19-8a0C-4650-8621-7077a6de8ee6";
      it("allows uuid", async function () {
        await impersonating("torgen", () =>
          settings.StaticJitsiMeeting.set(uuid)
        );
        chai.assert.deepEqual(
          await settings.Settings.findOneAsync("static_jitsi_meeting"),
          {
            _id: "static_jitsi_meeting",
            value: uuid,
            touched: 7,
            touched_by: "torgen",
          }
        );
      });

      it("canonicalizes", async function () {
        await impersonating("torgen", () =>
          settings.StaticJitsiMeeting.set("it's ya boy Voynich")
        );
        chai.assert.deepEqual(
          await settings.Settings.findOneAsync("static_jitsi_meeting"),
          {
            _id: "static_jitsi_meeting",
            value: "its_ya_boy_voynich",
            touched: 7,
            touched_by: "torgen",
          }
        );
      });
    });
  });

  describe("get", () =>
    it("allows legacy values", async function () {
      // The old version used string as the value for all types, so if the
      // database has a string instead of a boolean, convert it.
      await settings.Settings.upsertAsync("embed_puzzles", {
        $set: {
          value: "false",
          touched: 4,
          touched_by: "cjb",
        },
      });
      chai.assert.isFalse(await settings.EmbedPuzzles.get());
    }));

  describe("changeSetting method", function () {
    it("doesn't create setting", async function () {
      await assertRejects(
        callAs("changeSetting", "torgen", "foo", "qux"),
        Match.Error
      );
    });
  });
});
