// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import './edit_tag_name.html';

import canonical from '/lib/imports/canonical.js';
import { collection } from '/lib/imports/collections.js';
import { editableTemplate } from '/client/imports/ok_cancel_events.js';

editableTemplate(Template.edit_tag_name, {
  ok(val, evt, tem) {
    if (val) {
      const thing = collection(tem.data.type).findOne(tem.data.id);
      const canon = canonical(tem.data.name);
      const newCanon = canonical(val);
      if ((newCanon !== canon) && (thing.tags[newCanon] != null)) {
        return;
      }
      return Meteor.call('renameTag', {type:tem.data.type, object:tem.data.id, old_name:tem.data.name, new_name: val});
    }
  }
});

Template.edit_tag_name.onCreated(function() {
  return this.newTagName = new ReactiveVar(this.data.name);
});

Template.edit_tag_name.events({
  'input/focus input'(event, template) {
    return template.newTagName.set(event.currentTarget.value);
  }
});

Template.edit_tag_name.helpers({
  tagEditClass() {
    const val = Template.instance().newTagName.get();
    if (!val) { return 'error'; }
    const cval = canonical(val);
    if (val === this.name) { return 'info'; }
    if (cval === canonical(this.name)) { return 'success'; }
    if (collection(this.type).findOne({_id: this.id}).tags[cval] != null) { return 'error'; }
    return 'success';
  },
  tagEditStatus() {
    const val = Template.instance().newTagName.get();
    if (!val) { return 'Cannot be empty'; }
    if (val === this.name) { return 'Unchanged'; }
    const cval = canonical(val);
    if (cval === canonical(this.name)) { return; }
    if (collection(this.type).findOne({_id: this.id}).tags[cval] != null) { return 'Tag already exists'; }
  },
  canon() { return canonical(this.name); }
});
