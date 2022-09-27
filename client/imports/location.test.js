import { distance } from "./location.js";
import chai from "chai";

const KRESGE = {
  type: "Point",
  coordinates: [-71.0972017, 42.3581396],
};

const NANO = {
  type: "Point",
  coordinates: [-71.0925722, 42.3600819],
};

const WATERLOO_MC = {
  type: "Point",
  coordinates: [-80.5461258, 43.4721556],
};

describe("distance", () =>
  it("calculates distance", function () {
    chai.assert.approximately(distance(KRESGE, WATERLOO_MC), 484, 0.5);
    // opposite direction should be the same
    chai.assert.approximately(distance(WATERLOO_MC, KRESGE), 484, 0.5);
    chai.assert.approximately(distance(KRESGE, NANO), 0.27, 0.005);
  }));
