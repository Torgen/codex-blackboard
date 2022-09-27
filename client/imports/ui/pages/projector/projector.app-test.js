import {
  afterFlushPromise,
  login,
  logout,
} from "/client/imports/app_test_helpers.js";
import Router from "/client/imports/router.js";
import chai from "chai";
import sinon from "sinon";

describe("projector", function () {
  this.timeout(20000);
  let clock = null;
  beforeEach(() => (clock = sinon.useFakeTimers({ toFake: ["setInterval"] })));

  afterEach(() => clock.restore());

  before(async () => await login("testy", "Teresa Tybalt", "", "failphrase"));

  after(async () => await logout());

  it("operates", async function () {
    Router.ProjectorPage();
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
