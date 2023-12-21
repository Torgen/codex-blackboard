import {
  afterFlushPromise,
  login,
  logout
} from "/client/imports/app_test_helpers.js";
import { ProjectorPage } from "/client/imports/router.js";
import { PeriodicStats } from "/lib/imports/collections";
import { StatsCollectionTime } from "/lib/imports/settings.js";
import { waitForDocument } from "/lib/imports/testutils.js";
import chai from "chai";
import sinon from "sinon";

describe("projector", function () {
  this.timeout(30000);
  let clock = null;
  beforeEach(() => (clock = sinon.useFakeTimers({ toFake: ["setInterval"] })));

  afterEach(() => clock.restore());

  before(async () => await login("testy", "Teresa Tybalt", "", "failphrase"));

  after(async function () {
    StatsCollectionTime.set(0);
    await logout();
  });

  it("operates", async function () {
    ProjectorPage();
    await afterFlushPromise();
    const page = $("#projector_page");
    if (!page.children().size()) {
      await new Promise((resolve) => page.one("loaded", resolve));
    }
    chai.assert.isTrue(
      page
        .find('[data-projector-view="chart"]')
        .hasClass("projector-current-view")
    );
    chai.assert.isTrue(
      page.find('[data-projector-view="map"]').hasClass("projector-hidden-view")
    );
    chai.assert.isTrue(
      page
        .find('[data-projector-view="graph"]')
        .hasClass("projector-hidden-view")
    );
    clock.tick(9000);
    await afterFlushPromise();
    StatsCollectionTime.set(1);
    await waitForDocument(PeriodicStats, { stream: "solvers_online" });
    chai.assert.isTrue(
      page
        .find('[data-projector-view="chart"]')
        .hasClass("projector-current-view")
    );
    chai.assert.isTrue(
      page.find('[data-projector-view="map"]').hasClass("projector-hidden-view")
    );
    chai.assert.isTrue(
      page
        .find('[data-projector-view="graph"]')
        .hasClass("projector-hidden-view")
    );
    clock.tick(1000);
    await afterFlushPromise();
    chai.assert.isTrue(
      page
        .find('[data-projector-view="chart"]')
        .hasClass("projector-previous-view")
    );
    chai.assert.isTrue(
      page
        .find('[data-projector-view="map"]')
        .hasClass("projector-current-view")
    );
    chai.assert.isTrue(
      page
        .find('[data-projector-view="graph"]')
        .hasClass("projector-hidden-view")
    );
    clock.tick(10000);
    await afterFlushPromise();
    chai.assert.isTrue(
      page
        .find('[data-projector-view="chart"]')
        .hasClass("projector-hidden-view")
    );
    chai.assert.isTrue(
      page
        .find('[data-projector-view="map"]')
        .hasClass("projector-previous-view")
    );
    chai.assert.isTrue(
      page
        .find('[data-projector-view="graph"]')
        .hasClass("projector-current-view")
    );
    clock.tick(10000);
    await afterFlushPromise();
    chai.assert.isTrue(
      page
        .find('[data-projector-view="chart"]')
        .hasClass("projector-current-view")
    );
    chai.assert.isTrue(
      page.find('[data-projector-view="map"]').hasClass("projector-hidden-view")
    );
    chai.assert.isTrue(
      page
        .find('[data-projector-view="graph"]')
        .hasClass("projector-previous-view")
    );
  });
});
