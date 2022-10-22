import { positionOrDefault, solarLongitude } from "./geography.js";
import chai from "chai";

describe("positionOrDefault", function () {
  it("returns explicit position", () =>
    chai.assert.deepEqual(
      positionOrDefault({ type: "Point", coordinates: [75.5, -20] }, "sklanch"),
      { lat: -20, lng: 75.5 }
    ));

  it("randomizes unset position", () =>
    chai.assert.deepEqual(positionOrDefault(undefined, "sklanch"), {
      lat: -20.7275390625,
      lng: -19.9964096744658,
    }));
});

describe("solarLongitude", function () {
  it("is over Greenwich", () =>
    chai.assert.equal(solarLongitude(1645876800000), 0));

  it("is over California", () =>
    chai.assert.equal(solarLongitude(1645905600000), -120));

  it("is over Japan", () =>
    chai.assert.equal(solarLongitude(1645844439000), 134.8375));
});
