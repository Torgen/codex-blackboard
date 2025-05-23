import sinon from "sinon";
import { PeriodicStats, Presence } from "/lib/imports/collections.js";
import { StatsCollectionTime } from "/lib/imports/settings.js";
import { clearCollections, waitForDocument } from "/lib/imports/testutils.js";
import collectPeriodicStats from "/server/imports/periodic_stats.js";
import { impersonating } from "/server/imports/impersonate.js";

describe("periodic stats collection", function () {
  this.timeout(10000);
  let collector, clock, mockMeteor, setTimeout, clearTimeout;
  beforeEach(async function () {
    await clearCollections(PeriodicStats, Presence);
    await StatsCollectionTime.reset();
    clock = sinon.useFakeTimers({ toFake: ["Date"], now: 7 });
    mockMeteor = sinon.mock(Meteor);
    setTimeout = mockMeteor.expects("setTimeout");
    clearTimeout = mockMeteor.expects("clearTimeout").never();
  });

  afterEach(function () {
    clock.restore();
    collector.stop();
    mockMeteor.verify();
  });

  it("collects on schedule", async function () {
    const a = await Presence.insertAsync({ scope: "online", nick: "a" });
    const b = await Presence.insertAsync({ scope: "online", nick: "b" });
    const c = await Presence.insertAsync({ scope: "online", nick: "c" });
    collector = await collectPeriodicStats();
    setTimeout
      .once()
      .withArgs(sinon.match.func, 60000)
      .returns("first timeout");
    await impersonating("torgen", () => StatsCollectionTime.set(1));
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 7 },
      { value: 3 }
    );
    setTimeout.verify();
    const callback = setTimeout.firstCall.firstArg;
    setTimeout.resetHistory();
    await Presence.removeAsync(c);
    clock.tick(60000);
    setTimeout
      .once()
      .withArgs(sinon.match.func, 60000)
      .returns("second timeout");
    callback();
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 60007 },
      { value: 2 }
    );
    clearTimeout.once().withArgs("second timeout");
  });

  it("reschedules to past", async function () {
    const a = await Presence.insertAsync({ scope: "online", nick: "a" });
    const b = await Presence.insertAsync({ scope: "online", nick: "b" });
    const c = await Presence.insertAsync({ scope: "online", nick: "c" });
    collector = await collectPeriodicStats();
    setTimeout
      .once()
      .withArgs(sinon.match.func, 120000)
      .returns("first timeout");
    await impersonating("torgen", () => StatsCollectionTime.set(2));
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 7 },
      { value: 3 }
    );
    setTimeout.verify();
    setTimeout.resetHistory();
    clearTimeout.once().withArgs("first timeout");
    setTimeout
      .once()
      .withArgs(sinon.match.func, 60000)
      .returns("second timeout");
    await Presence.removeAsync(c);
    clock.tick(90000);
    await impersonating("torgen", () => StatsCollectionTime.set(1));
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 90007 },
      { value: 2 }
    );
    clearTimeout.verify();
    clearTimeout.resetHistory().once().withArgs("second timeout");
  });

  it("reschedules to nearer future", async function () {
    const a = await Presence.insertAsync({ scope: "online", nick: "a" });
    const b = await Presence.insertAsync({ scope: "online", nick: "b" });
    const c = await Presence.insertAsync({ scope: "online", nick: "c" });
    collector = await collectPeriodicStats();
    setTimeout
      .once()
      .withArgs(sinon.match.func, 120000)
      .returns("first timeout");
    await impersonating("torgen", () => StatsCollectionTime.set(2));
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 7 },
      { value: 3 }
    );
    setTimeout.verify();
    clearTimeout.once().withArgs("first timeout");
    const p = new Promise((resolve) =>
      setTimeout
        .resetHistory()
        .once()
        .withArgs(sinon.match.func, 30000)
        .callsFake(() => {
          resolve();
          return "second timeout";
        })
    );
    await Presence.removeAsync(c);
    clock.tick(30000);
    await impersonating("torgen", () => StatsCollectionTime.set(1));
    await p;
    clearTimeout.verify();
    clearTimeout.resetHistory().once().withArgs("second timeout");
  });

  it("reschedules after short pause", async function () {
    const a = await Presence.insertAsync({ scope: "online", nick: "a" });
    const b = await Presence.insertAsync({ scope: "online", nick: "b" });
    const c = await Presence.insertAsync({ scope: "online", nick: "c" });
    collector = await collectPeriodicStats();
    setTimeout
      .once()
      .withArgs(sinon.match.func, 60000)
      .returns("first timeout");
    await impersonating("torgen", () => StatsCollectionTime.set(1));
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 7 },
      { value: 3 }
    );
    setTimeout.verify();
    const p = new Promise((resolve) =>
      clearTimeout.once().withArgs("first timeout").callsFake(resolve)
    );
    clock.tick(20000);
    await impersonating("torgen", () => StatsCollectionTime.set(0));
    await p;
    clearTimeout.verify();
    const p2 = new Promise((resolve) =>
      setTimeout
        .resetHistory()
        .once()
        .withArgs(sinon.match.func, 20000)
        .callsFake(() => {
          resolve();
          return "second timeout";
        })
    );
    clock.tick(20000);
    await impersonating("torgen", () => StatsCollectionTime.set(1));
    await p2;
    setTimeout.verify();
    clearTimeout.resetHistory().once().withArgs("second timeout");
  });

  it("collects after long pause", async function () {
    const a = await Presence.insertAsync({ scope: "online", nick: "a" });
    const b = await Presence.insertAsync({ scope: "online", nick: "b" });
    const c = await Presence.insertAsync({ scope: "online", nick: "c" });
    collector = await collectPeriodicStats();
    setTimeout
      .once()
      .withArgs(sinon.match.func, 60000)
      .returns("first timeout");
    await impersonating("torgen", () => StatsCollectionTime.set(1));
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 7 },
      { value: 3 }
    );
    setTimeout.verify();
    const p = new Promise((resolve) =>
      clearTimeout.once().withArgs("first timeout").callsFake(resolve)
    );
    clock.tick(40000);
    await impersonating("torgen", () => StatsCollectionTime.set(0));
    await p;
    clearTimeout.verify();
    await Presence.removeAsync(c);
    clock.tick(40000);
    setTimeout
      .resetHistory()
      .once()
      .withArgs(sinon.match.func, 60000)
      .returns("second timeout");
    await impersonating("torgen", () => StatsCollectionTime.set(1));
    await waitForDocument(
      PeriodicStats,
      { stream: "solvers_online", timestamp: 80007 },
      { value: 2 }
    );
    setTimeout.verify();
    clearTimeout.resetHistory().once().withArgs("second timeout");
  });
});
