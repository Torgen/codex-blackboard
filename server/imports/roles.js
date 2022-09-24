/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { callAs } from '/server/imports/impersonate.coffee';
import { Roles } from '/lib/imports/collections.coffee';

export class RoleManager {

  start() {
    const release = () => {
      let holder;
      [holder, this.holder, this.timeout] = [this.holder, null, null];
      return callAs('releaseOnduty', holder);
    };

    const enqueue = expires_at => {
      const now = Date.now();
      if (expires_at <= now) {
        return release();
      } else {
        return this.timeout = Meteor.setTimeout(release, (expires_at - now));
      }
    };

    return this.handle = Roles.find({_id: 'onduty'}, {fields: {holder: 1, expires_at: 1}}).observeChanges({
      added: (role, {holder, expires_at}) => {
        this.holder = holder;
        const now = Date.now();
        return enqueue(expires_at);
      },

      changed: (role, {holder, expires_at}) => {
        if (holder != null) {
          this.holder = holder;
        }
        if (expires_at != null) {
          Meteor.clearTimeout(this.timeout);
          return enqueue(expires_at);
        }
      },

      removed: role => {
        if (this.timeout != null) {
          Meteor.clearTimeout(this.timeout);
          this.timeout = null;
          return this.holder = null;
        }
      }
    });
  }

  stop() {
    if (this.timeout != null) {
      Meteor.clearTimeout(this.timeout);
      this.timeout = null;
    }
    return this.handle.stop();
  }
}

