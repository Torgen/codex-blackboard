// For side effects
import "/lib/model.js";
import { CallIns, Messages, Puzzles, Roles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import { RoleRenewalTime } from "/lib/imports/settings.js";

describe("incorrectCallIn", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(function () {
    resetDatabase();
    RoleRenewalTime.ensure();
  });

  let puzzle = null;
  let callin = null;

  describe("on answer", function () {
    beforeEach(function () {
      puzzle = Puzzles.insert({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = CallIns.insert({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "answer",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
      Roles.insert({
        _id: "onduty",
        holder: "cjb",
        claimed_at: 2,
        renewed_at: 2,
        expires_at: 3600002,
      });
    });

    it("fails without login", () =>
      chai.assert.throws(
        () => Meteor.call("incorrectCallIn", callin),
        Match.Error
      ));

    describe("when logged in", function () {
      beforeEach(() => callAs("incorrectCallIn", "cjb", callin));

      it("updates callin", function () {
        const c = CallIns.findOne(callin);
        chai.assert.include(c, { status: "rejected" }, { resolved: 7 });
      });

      it("oplogs", () =>
        chai.assert.lengthOf(
          Messages.find({
            type: "puzzles",
            id: puzzle,
            stream: "callins",
          }).fetch(),
          1
        ));

      it("notifies puzzle chat", () =>
        chai.assert.lengthOf(
          Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetch(),
          1
        ));

      it("notifies general chat", () =>
        chai.assert.lengthOf(
          Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetch(),
          1
        ));

      it("renews onduty", () =>
        chai.assert.deepInclude(Roles.findOne("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 7,
          expires_at: 3600007,
        }));
    });

    describe("when not onduty", function () {
      beforeEach(() => callAs("incorrectCallIn", "cscott", callin));

      it("leaves onduty alone", () =>
        chai.assert.deepInclude(Roles.findOne("onduty"), {
          holder: "cjb",
          claimed_at: 2,
          renewed_at: 2,
          expires_at: 3600002,
        }));
    });
  });

  describe("on interaction request", function () {
    beforeEach(function () {
      puzzle = Puzzles.insert({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = CallIns.insert({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "interaction request",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
    });

    describe("without response", function () {
      it("fails without login", () =>
        chai.assert.throws(
          () => Meteor.call("incorrectCallIn", callin),
          Match.Error
        ));

      describe("when logged in", function () {
        beforeEach(() => callAs("incorrectCallIn", "cjb", callin));

        it("updates callin", function () {
          const c = CallIns.findOne(callin);
          chai.assert.include(c, {
            status: "rejected",
            resolved: 7,
          });
        });

        it("does not oplog", () =>
          chai.assert.lengthOf(
            Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetch(),
            0
          ));

        it("notifies puzzle chat", function () {
          const o = Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.notInclude(o[0].body, "(Foo)", "message");
        });

        it("notifies general chat", function () {
          const o = Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "(Foo)", "message");
        });
      });
    });

    describe("with response", function () {
      it("fails without login", () =>
        chai.assert.throws(
          () => Meteor.call("incorrectCallIn", callin, "sediment"),
          Match.Error
        ));

      describe("when logged in", function () {
        beforeEach(() => callAs("incorrectCallIn", "cjb", callin, "sediment"));

        it("updates callin", function () {
          const c = CallIns.findOne(callin);
          chai.assert.include(c, {
            status: "rejected",
            response: "sediment",
            resolved: 7,
          });
        });

        it("does not oplog", () =>
          chai.assert.lengthOf(
            Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetch(),
            0
          ));

        it("notifies puzzle chat", function () {
          const o = Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
          chai.assert.notInclude(o[0].body, "(Foo)", "message");
        });

        it("notifies general chat", function () {
          const o = Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
          chai.assert.include(o[0].body, "(Foo)", "message");
        });
      });
    });
  });

  describe("on message to hq", function () {
    beforeEach(function () {
      puzzle = Puzzles.insert({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = CallIns.insert({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "message to hq",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
    });

    describe("without response", function () {
      it("fails without login", () =>
        chai.assert.throws(
          () => Meteor.call("incorrectCallIn", callin),
          Match.Error
        ));

      describe("when logged in", function () {
        beforeEach(() => callAs("incorrectCallIn", "cjb", callin));

        it("updates callin", function () {
          const c = CallIns.findOne(callin);
          chai.assert.include(c, {
            status: "rejected",
            resolved: 7,
          });
        });

        it("does not oplog", () =>
          chai.assert.lengthOf(
            Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetch(),
            0
          ));

        it("notifies puzzle chat", function () {
          const o = Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.notInclude(o[0].body, "(Foo)", "message");
        });

        it("notifies general chat", function () {
          const o = Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "(Foo)", "message");
        });
      });
    });

    describe("with response", function () {
      it("fails without login", () =>
        chai.assert.throws(
          () => Meteor.call("incorrectCallIn", callin, "sediment"),
          Match.Error
        ));

      describe("when logged in", function () {
        beforeEach(() => callAs("incorrectCallIn", "cjb", callin, "sediment"));

        it("updates callin", function () {
          const c = CallIns.findOne(callin);
          chai.assert.include(c, {
            status: "rejected",
            response: "sediment",
            resolved: 7,
          });
        });

        it("does not oplog", () =>
          chai.assert.lengthOf(
            Messages.find({
              type: "puzzles",
              id: puzzle,
              stream: "callins",
            }).fetch(),
            0
          ));

        it("notifies puzzle chat", function () {
          const o = Messages.find({
            room_name: `puzzles/${puzzle}`,
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
          chai.assert.notInclude(o[0].body, "(Foo)", "message");
        });

        it("notifies general chat", function () {
          const o = Messages.find({
            room_name: "general/0",
            dawn_of_time: { $ne: true },
          }).fetch();
          chai.assert.lengthOf(o, 1);
          chai.assert.include(o[0], {
            nick: "cjb",
            action: true,
          });
          chai.assert.include(o[0].body, "REJECTED", "message");
          chai.assert.include(o[0].body, '"precipitate"', "message");
          chai.assert.include(o[0].body, "sediment", "message");
          chai.assert.include(o[0].body, "(Foo)", "message");
        });
      });
    });
  });

  describe("on expected callback", function () {
    beforeEach(function () {
      puzzle = Puzzles.insert({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "cscott",
        touched: 1,
        touched_by: "cscott",
        solved: null,
        solved_by: null,
        tags: {},
        feedsInto: [],
      });
      callin = CallIns.insert({
        name: "Foo:precipitate",
        target: puzzle,
        target_type: "puzzles",
        answer: "precipitate",
        callin_type: "expected callback",
        created: 2,
        created_by: "torgen",
        submitted_to_hq: true,
        backsolve: false,
        provided: false,
        status: "pending",
      });
    });

    describe("without response", function () {
      it("fails without login", () =>
        chai.assert.throws(
          () => Meteor.call("incorrectCallIn", callin),
          Match.Error
        ));

      it("fails when logged in", () =>
        chai.assert.throws(
          () => callAs("incorrectCallIn", "cjb", callin),
          Meteor.Error
        ));
    });

    describe("with response", function () {
      it("fails without login", () =>
        chai.assert.throws(
          () => Meteor.call("incorrectCallIn", callin, "sediment"),
          Match.Error
        ));

      it("fails when logged in", () =>
        chai.assert.throws(
          () => callAs("incorrectCallIn", "cjb", callin, "sediment"),
          Meteor.Error
        ));
    });
  });
});
