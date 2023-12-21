import chai from "chai";
import summarize_markers from "./summarize_markers.js";

class FakeMarker {
  constructor(name, online) {
    this.name = name;
    this.online = online;
  }
  getOpacity() {
    return this.online ? 1.0 : 0.5;
  }
  getTitle() {
    return this.name;
  }
  getIcon() {
    return `${this.name}.jpg`;
  }
}

// Some reusable fake markers so I don't get duplication complaints
const A_ONLINE = new FakeMarker("a", true);
const B_ONLINE = new FakeMarker("b", true);
const C_ONLINE = new FakeMarker("c", true);
const D_ONLINE = new FakeMarker("d", true);
const E_ONLINE = new FakeMarker("e", true);
const F_ONLINE = new FakeMarker("f", true);
const G_OFFLINE = new FakeMarker("g", false);
const H_OFFLINE = new FakeMarker("h", false);
const I_OFFLINE = new FakeMarker("i", false);
const J_OFFLINE = new FakeMarker("j", false);
const K_OFFLINE = new FakeMarker("k", false);
const L_OFFLINE = new FakeMarker("l", false);

describe("summarize_markers", function () {
  it("moves offline to the end", function () {
    chai.assert.deepEqual(
      summarize_markers([J_OFFLINE, B_ONLINE, H_OFFLINE, A_ONLINE, C_ONLINE]),
      [
        { gravatar: "b.jpg", title: "b", onlineness: "online" },
        { gravatar: "a.jpg", title: "a", onlineness: "online" },
        { gravatar: "c.jpg", title: "c", onlineness: "online" },
        { gravatar: "j.jpg", title: "j", onlineness: "offline" },
        { gravatar: "h.jpg", title: "h", onlineness: "offline" },
      ],
    );
  });

  it("truncates when only online", function () {
    chai.assert.deepEqual(
      summarize_markers([
        D_ONLINE,
        C_ONLINE,
        E_ONLINE,
        B_ONLINE,
        F_ONLINE,
        A_ONLINE,
      ]),
      [
        { gravatar: "d.jpg", title: "d", onlineness: "online" },
        { gravatar: "c.jpg", title: "c", onlineness: "online" },
        { gravatar: "e.jpg", title: "e", onlineness: "online" },
        { gravatar: "b.jpg", title: "b", onlineness: "online" },
        { summary: 2, title: "2 more online", onlineness: "online" },
      ],
    );
  });

  it("truncates when only offline", function () {
    chai.assert.deepEqual(
      summarize_markers([
        J_OFFLINE,
        I_OFFLINE,
        K_OFFLINE,
        H_OFFLINE,
        L_OFFLINE,
        G_OFFLINE,
      ]),
      [
        { gravatar: "j.jpg", title: "j", onlineness: "offline" },
        { gravatar: "i.jpg", title: "i", onlineness: "offline" },
        { gravatar: "k.jpg", title: "k", onlineness: "offline" },
        { gravatar: "h.jpg", title: "h", onlineness: "offline" },
        { summary: 2, title: "2 more offline", onlineness: "offline" },
      ],
    );
  });

  it("truncates only offline when possible", function () {
    chai.assert.deepEqual(
      summarize_markers([
        J_OFFLINE,
        I_OFFLINE,
        D_ONLINE,
        C_ONLINE,
        E_ONLINE,
        B_ONLINE,
      ]),
      [
        { gravatar: "d.jpg", title: "d", onlineness: "online" },
        { gravatar: "c.jpg", title: "c", onlineness: "online" },
        { gravatar: "e.jpg", title: "e", onlineness: "online" },
        { gravatar: "b.jpg", title: "b", onlineness: "online" },
        { summary: 2, title: "2 more offline", onlineness: "offline" },
      ],
    );
  });

  it("truncates online and offline", function () {
    chai.assert.deepEqual(
      summarize_markers([
        J_OFFLINE,
        I_OFFLINE,
        H_OFFLINE,
        D_ONLINE,
        C_ONLINE,
        E_ONLINE,
        B_ONLINE,
        F_ONLINE,
      ]),
      [
        { gravatar: "d.jpg", title: "d", onlineness: "online" },
        { gravatar: "c.jpg", title: "c", onlineness: "online" },
        { gravatar: "e.jpg", title: "e", onlineness: "online" },
        { summary: 2, title: "2 more online", onlineness: "online" },
        { summary: 3, title: "3 more offline", onlineness: "offline" },
      ],
    );
  });

  it("never truncates one online", function () {
    chai.assert.deepEqual(
      summarize_markers([
        J_OFFLINE,
        I_OFFLINE,
        K_OFFLINE,
        H_OFFLINE,
        L_OFFLINE,
        D_ONLINE,
      ]),
      [
        { gravatar: "d.jpg", title: "d", onlineness: "online" },
        { gravatar: "j.jpg", title: "j", onlineness: "offline" },
        { gravatar: "i.jpg", title: "i", onlineness: "offline" },
        { gravatar: "k.jpg", title: "k", onlineness: "offline" },
        { summary: 2, title: "2 more offline", onlineness: "offline" },
      ],
    );
  });

  it("never truncates one offline", function () {
    chai.assert.deepEqual(
      summarize_markers([
        D_ONLINE,
        C_ONLINE,
        E_ONLINE,
        B_ONLINE,
        F_ONLINE,
        J_OFFLINE,
      ]),
      [
        { gravatar: "d.jpg", title: "d", onlineness: "online" },
        { gravatar: "c.jpg", title: "c", onlineness: "online" },
        { gravatar: "e.jpg", title: "e", onlineness: "online" },
        { summary: 2, title: "2 more online", onlineness: "online" },
        { gravatar: "j.jpg", title: "j", onlineness: "offline" },
      ],
    );
  });
});
