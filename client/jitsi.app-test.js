import {
  waitForSubscriptions,
  afterFlushPromise,
  login,
  logout,
} from "./imports/app_test_helpers.js";
import {
  BlackboardPage,
  EditPage,
  PuzzlePage,
  LogisticsPage,
} from "/client/imports/router.js";
import jitsiModule from "./imports/jitsi.js";
import chai from "chai";
import sinon from "sinon";
import { reactiveLocalStorage } from "./imports/storage.js";
import { CLIENT_UUID } from "/client/imports/server_settings.js";
import { Puzzles } from "/lib/imports/collections.js";

const GRAVATAR_200 =
  "https://secure.gravatar.com/avatar/a24f643d34150c3b4053989db38251c9.jpg?d=wavatar&s=200";

class FakeJitsiMeet {
  dispose() {}
  once(event, handler) {}
  executeCommand(cmd, param) {}
  executeCommands(cmds) {}
}

const defaultLogin = () =>
  login("testy", "Teresa Tybalt", "fake@artifici.al", "failphrase");

describe("jitsi", function () {
  this.timeout(20000);

  let factory = null;
  beforeEach(function () {
    factory = sinon.mock(jitsiModule).expects("createJitsiMeet");
    factory.never();
  });

  const expectFactory = function () {
    const fake = new FakeJitsiMeet();
    const mock = sinon.mock(fake);
    factory.verify();
    factory.resetHistory();
    factory.once().returns(fake);
    return mock;
  };

  afterEach(async function () {
    await logout();
    sinon.verify();
  });

  it("uses static meeting name", async function () {
    const mock = expectFactory();
    const onceExp = mock.expects("once").twice();

    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    chai.assert.isTrue(
      factory.calledWithMatch(
        "codex_whiteNoiseFoyer",
        sinon.match.instanceOf(HTMLDivElement)
      )
    );
    chai.assert.isTrue(
      onceExp.getCalls().some(function (call) {
        if (call.calledWith("videoConferenceJoined", sinon.match.func)) {
          call.args[1]();
          return true;
        }
        return false;
      })
    );
    mock.expects("executeCommand").once().withArgs("subject", "Ringhunters");
    mock.expects("executeCommands").once().withArgs({
      displayName: "Teresa Tybalt (testy)",
      avatarUrl: GRAVATAR_200,
    });
    await afterFlushPromise();
  });

  it("shares meeting between blackboard and edit", async function () {
    const mock = expectFactory();
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    EditPage();
    await afterFlushPromise();
    chai.assert.equal(factory.callCount, 1);
  });

  it("shares meeting between blackboard and logistics", async function () {
    const mock = expectFactory();
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    await LogisticsPage();
    await waitForSubscriptions();
    await afterFlushPromise();
    chai.assert.equal(factory.callCount, 1);
  });

  it("joins new meeting when moving from blackboard to puzzle", async function () {
    const mock1 = expectFactory();
    const dispose1 = mock1.expects("dispose").never();
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    dispose1.verify();
    dispose1.once();
    const mock2 = expectFactory();
    const onceExp = mock2.expects("once").twice();
    const dispose2 = mock2.expects("dispose").never();
    const puzz = Puzzles.findOne({ name: "In Memoriam" });
    PuzzlePage(puzz._id);
    await afterFlushPromise();
    await waitForSubscriptions();
    dispose1.verify();
    dispose2.verify();
    chai.assert.isTrue(
      onceExp.getCalls().some(function (call) {
        if (call.calledWith("videoConferenceJoined", sinon.match.func)) {
          call.args[1]();
          return true;
        }
        return false;
      })
    );
    mock2.expects("executeCommand").once().withArgs("subject", "In Memoriam");
    await afterFlushPromise();
    dispose2.once();
  });

  it("stays in meeting when pinned", async function () {
    const mock1 = expectFactory();
    const dispose1 = mock1.expects("dispose").never();
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    $(".bb-jitsi-pin").click();
    await afterFlushPromise();
    const puzz = Puzzles.findOne({ name: "In Memoriam" });
    PuzzlePage(puzz._id);
    await afterFlushPromise();
    await waitForSubscriptions();
    dispose1.verify();
    dispose1.once();
    const mock2 = expectFactory();
    $(".bb-jitsi-unpin").click();
    await afterFlushPromise();
    dispose1.verify();
  });

  it("doesn't rejoin when hangup callback is called", async function () {
    const mock1 = expectFactory();
    const on1 = mock1.expects("once").twice();
    const dispose1 = mock1.expects("dispose").never();
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    dispose1.verify();
    dispose1.once();
    on1.verify();
    chai.assert.isTrue(
      on1.getCalls().some(function (call) {
        if (call.calledWith("videoConferenceLeft", sinon.match.func)) {
          call.args[1]();
          return true;
        }
        return false;
      })
    );
    await afterFlushPromise();
    dispose1.verify();
    const puzz = Puzzles.findOne({ name: "In Memoriam" });
    PuzzlePage(puzz._id);
    await afterFlushPromise();
    await waitForSubscriptions();
    const mock2 = expectFactory();
    $(".bb-join-jitsi").click();
    await afterFlushPromise();
  });

  it("disposes when another tab joins meeting", async function () {
    const mock1 = expectFactory();
    const dispose1 = mock1.expects("dispose").never();
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    dispose1.verify();
    dispose1.once();
    try {
      reactiveLocalStorage.setItem("jitsiTabUUID", Random.id());
      await afterFlushPromise();
      dispose1.verify();
      const puzz = Puzzles.findOne({ name: "In Memoriam" });
      PuzzlePage(puzz._id);
      await afterFlushPromise();
      await waitForSubscriptions();
    } finally {
      reactiveLocalStorage.removeItem("jitsiTabUUID");
    }
  });

  it("join button clobbers other tab", async function () {
    reactiveLocalStorage.setItem("jitsiTabUUID", Random.id());
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    const mock = expectFactory();
    $(".bb-join-jitsi").click();
    await afterFlushPromise();
    chai.assert.equal(
      reactiveLocalStorage.getItem("jitsiTabUUID"),
      CLIENT_UUID
    );
  });

  return it("doesn't rejoin when mute preference changes", async function () {
    const mock1 = expectFactory();
    const dispose1 = mock1.expects("dispose").never();
    BlackboardPage();
    await defaultLogin();
    await afterFlushPromise();
    await waitForSubscriptions();
    try {
      reactiveLocalStorage.setItem("startAudioMuted", "false");
      await afterFlushPromise();
      dispose1.verify();
      dispose1.once();
    } finally {
      reactiveLocalStorage.setItem("startAudioMuted", null);
    }
  });
});
