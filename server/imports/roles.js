import { callAs } from "/server/imports/impersonate.js";
import { Roles } from "/lib/imports/collections.js";

export class RoleManager {
  async start() {
    const release = async () => {
      let holder;
      [holder, this.holder, this.timeout] = [this.holder, null, null];
      await callAs("releaseOnduty", holder);
    };

    const enqueue = async (expires_at) => {
      const now = Date.now();
      if (expires_at <= now) {
        await release();
      } else {
        this.timeout = Meteor.setTimeout(release, expires_at - now);
      }
    };

    this.handle = await Roles.find(
      { _id: "onduty" },
      { fields: { holder: 1, expires_at: 1 } }
    ).observeChangesAsync({
      added: async (role, { holder, expires_at }) => {
        this.holder = holder;
        const now = Date.now();
        await enqueue(expires_at);
      },
      changed: async (role, { holder, expires_at }) => {
        if (holder != null) {
          this.holder = holder;
        }
        if (expires_at != null) {
          Meteor.clearTimeout(this.timeout);
          await enqueue(expires_at);
        }
      },
      removed: (role) => {
        if (this.timeout != null) {
          Meteor.clearTimeout(this.timeout);
          this.timeout = null;
          this.holder = null;
        }
      },
    });
  }

  stop() {
    if (this.timeout != null) {
      Meteor.clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.handle.stop();
  }
}
