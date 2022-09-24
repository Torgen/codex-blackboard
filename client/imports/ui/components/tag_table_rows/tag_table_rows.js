// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import canonical from '/lib/imports/canonical.js';
import { collection } from '/lib/imports/collections.js';
import okCancelEvents from '/client/imports/ok_cancel_events.js';
import './tag_table_rows.html';
import '../edit_tag_name/edit_tag_name.js';
import '../edit_tag_value/edit_tag_value.js';

Template.tag_table_rows.onCreated(function() {
  this.newTagName = new ReactiveVar('');
  return this.autorun(() => {
    if (Template.currentData().adding.adding()) {
      return Tracker.afterFlush(() => {
        return this.$('.bb-add-tag input').focus();
      });
    } else {
      return this.newTagName.set('');
    }
  });
});

Template.tag_table_rows.events({
  'input/focus .bb-add-tag input'(event, template) {
    return template.newTagName.set(event.currentTarget.value);
  }
});

Template.tag_table_rows.events(okCancelEvents('.bb-add-tag input', {
  ok(value, event, template) {
    if (!this.adding.adding()) { return; }
    this.adding.done();
    template.newTagName.set('');
    const cval = canonical(value);
    if (collection(this.type).findOne({_id: this.id}).tags[cval] != null) { return; }
    Meteor.call('setTag', {type: this.type, object: this.id, name: value, value: ''});
    // simulation is enough for us to start editing the value if the event was enter or tab
    if ([9,13].includes(event.which)) {
      return Tracker.afterFlush(() => template.$(`tr[data-tag-name='${cval}'] .bb-edit-tag-value`).trigger('bb-edit'));
    }
  },

  cancel(event, template) {
    this.adding.done();
    return template.newTagName.set('');
  }
}
)
);

Template.tag_table_rows.helpers({
  tags() {
    const tags = collection(this.type).findOne({_id: this.id}, {fields: {tags: 1}})?.tags || {};
    return (() => {
      const result = [];
      for (let canon of Object.keys(tags).sort()) {         if (!((Session.equals('currentPage', 'blackboard') && 
        ((canon === 'status') || 
            ((this.type !== 'rounds') && (canon === 'answer')))) || 
        (((canon === 'answer') || (canon === 'backsolve')) && 
        (Session.equals('currentPage', 'puzzle') || Session.equals('currentPage', 'logistics_page'))))) {var res, t;
        
          result.push((
        (t = tags[canon]),
        (res = { _id: `${this.id}/${canon}`, name: t.name, canon, value: t.value, touched_by: t.touched_by })
      ));
        }
      }
      return result;
    })();
  },
  tagAddClass() {
    const val = Template.instance().newTagName.get();
    if (!val) { return 'error'; }
    const cval = canonical(val);
    if (collection(this.type).findOne({_id: this.id}).tags[cval] != null) { return 'error'; }
    return 'success';
  },
  tagAddStatus() {
    const val = Template.instance().newTagName.get();
    if (!val) { return 'Cannot be empty'; }
    const cval = canonical(val);
    if (collection(this.type).findOne({_id: this.id}).tags[cval] != null) { return 'Tag already exists'; }
  }
});
