import chai from "chai";
import "./timestamp.js";

describe("pretty_ts", function () {
  before(() => Session.set("currentTime", 1));
  describe("duration", function () {
    it("returns the future", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 70000, style: "duration" }
        }),
        "in the future"
      ));

    it("returns just now for the near future", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 50000, style: "duration" }
        }),
        "just now"
      ));

    it("returns just now for the recent past", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -10000, style: "duration" }
        }),
        "just now"
      ));

    it("returns minute ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -60001, style: "duration" }
        }),
        "1 minute ago"
      ));

    it("returns minutes ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -300001, style: "duration" }
        }),
        "5 minutes ago"
      ));

    it("returns hour ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -3600001, style: "duration" }
        }),
        "1 hour ago"
      ));

    it("returns hours ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -18000001, style: "duration" }
        }),
        "5 hours ago"
      ));

    it("returns hours and minutes ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -18120001, style: "duration" }
        }),
        "5 hours 2 minutes ago"
      ));

    it("returns day ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -86400001, style: "duration" }
        }),
        "1 day ago"
      ));

    it("returns days ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -259200001, style: "duration" }
        }),
        "3 days ago"
      ));

    it("returns days hours and minutes ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -277320001, style: "duration" }
        }),
        "3 days 5 hours 2 minutes ago"
      ));

    it("returns week ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -7 * 86400001, style: "duration" }
        }),
        "1 week ago"
      ));

    it("returns weeks ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -21 * 86400001, style: "duration" }
        }),
        "3 weeks ago"
      ));

    it("returns weeks days hours and minutes ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -25 * 86400001 - 18120001, style: "duration" }
        }),
        "3 weeks 4 days 5 hours 2 minutes ago"
      ));
  });

  describe("brief duration", function () {
    it("returns the future", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 70000, style: "brief_duration" }
        }),
        "in the future"
      ));

    it("returns just now for the near future", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 50000, style: "brief_duration" }
        }),
        "just now"
      ));

    it("returns just now for the recent past", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -10000, style: "brief_duration" }
        }),
        "just now"
      ));

    it("returns minute ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -70001, style: "brief_duration" }
        }),
        "1 minute ago"
      ));

    it("returns minutes ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -330001, style: "brief_duration" }
        }),
        "5 minutes ago"
      ));

    it("returns hour ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -3720001, style: "brief_duration" }
        }),
        "1 hour ago"
      ));

    it("returns hours ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -18120001, style: "brief_duration" }
        }),
        "5 hours ago"
      ));

    it("returns day ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -86700001, style: "brief_duration" }
        }),
        "1 day ago"
      ));

    it("returns days ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -261120001, style: "brief_duration" }
        }),
        "3 days ago"
      ));

    it("returns week ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -10 * 86400001, style: "brief_duration" }
        }),
        "1 week ago"
      ));

    it("returns weeks ago", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: {
            timestamp: -25 * 86400001 - 18120001,
            style: "brief_duration"
          }
        }),
        "3 weeks ago"
      ));
  });

  describe("future", function () {
    it("returns now", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -70000, style: "future" }
        }),
        "now"
      ));

    it("returns in minute ", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 60001, style: "future" }
        }),
        "in 1 minute"
      ));

    it("returns in minutes", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 300001, style: "future" }
        }),
        "in 5 minutes"
      ));

    it("returns in hour", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 3600001, style: "future" }
        }),
        "in 1 hour"
      ));

    it("returns in hours", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 18000001, style: "future" }
        }),
        "in 5 hours"
      ));

    it("returns in hours and minutes", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 18120001, style: "future" }
        }),
        "in 5 hours 2 minutes"
      ));

    it("returns in day", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 86400001, style: "future" }
        }),
        "in 1 day"
      ));

    it("returns in days", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 259200001, style: "future" }
        }),
        "in 3 days"
      ));

    it("returns in days hours and minutes", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 277320001, style: "future" }
        }),
        "in 3 days 5 hours 2 minutes"
      ));

    it("returns in week", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 7 * 86400001, style: "future" }
        }),
        "in 1 week"
      ));

    it("returns in weeks", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 21 * 86400001, style: "future" }
        }),
        "in 3 weeks"
      ));

    it("returns in weeks days hours and minutes", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: +25 * 86400001 + 18120001, style: "future" }
        }),
        "in 3 weeks 4 days 5 hours 2 minutes"
      ));
  });

  describe("brief future", function () {
    it("returns now", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: -70000, style: "brief_future" }
        }),
        "now"
      ));

    it("returns in minute", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 70001, style: "brief_future" }
        }),
        "in 1 minute"
      ));

    it("returns in minutes", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 330001, style: "brief_future" }
        }),
        "in 5 minutes"
      ));

    it("returns in hour", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 3720001, style: "brief_future" }
        }),
        "in 1 hour"
      ));

    it("returns in hours", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 18120001, style: "brief_future" }
        }),
        "in 5 hours"
      ));

    it("returns in day", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 86700001, style: "brief_future" }
        }),
        "in 1 day"
      ));

    it("returns in days", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 261120001, style: "brief_future" }
        }),
        "in 3 days"
      ));

    it("returns in week", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 10 * 86400001, style: "brief_future" }
        }),
        "in 1 week"
      ));

    it("returns in weeks", () =>
      chai.assert.equal(
        Blaze._globalHelpers.pretty_ts({
          hash: { timestamp: 25 * 86400001 + 18120001, style: "brief_future" }
        }),
        "in 3 weeks"
      ));
  });
});
