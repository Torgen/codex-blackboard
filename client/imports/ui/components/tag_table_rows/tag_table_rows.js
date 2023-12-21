import canonical from "/lib/imports/canonical.js";
import { collection } from "/lib/imports/collections.js";
import okCancelEvents from "/client/imports/ok_cancel_events.js";
import "./tag_table_rows.html";
import "../edit_tag_name/edit_tag_name.js";
import "../edit_tag_value/edit_tag_value.js";

Template.tag_table_rows.onCreated(function () {
  this.newTagName = new ReactiveVar("");
  this.autorun(() => {
    if (Template.currentData().adding.adding()) {
      Tracker.afterFlush(() => {
        this.$(".bb-add-tag input").focus();
      });
    } else {
      this.newTagName.set("");
    }
  });
});

Template.tag_table_rows.events({
  "input/focus .bb-add-tag input"(event, template) {
    template.newTagName.set(event.currentTarget.value);
  },
});

Template.tag_table_rows.events(
  okCancelEvents(".bb-add-tag input", {
    ok(value, event, template) {
      if (!this.adding.adding()) {
        return;
      }
      this.adding.done();
      template.newTagName.set("");
      const cval = canonical(value);
      if (collection(this.type).findOne({ _id: this.id }).tags[cval] != null) {
        return;
      }
      Meteor.call("setTag", {
        type: this.type,
        object: this.id,
        name: value,
        value: "",
      });
      // simulation is enough for us to start editing the value if the event was enter or tab
      if ([9, 13].includes(event.which)) {
        Tracker.afterFlush(() =>
          template
            .$(`tr[data-tag-name='${cval}'] .bb-edit-tag-value`)
            .trigger("bb-edit"),
        );
      }
    },

    cancel(event, template) {
      this.adding.done();
      template.newTagName.set("");
    },
  }),
);

Template.tag_table_rows.helpers({
  tags() {
    const tags =
      collection(this.type).findOne({ _id: this.id }, { fields: { tags: 1 } })
        ?.tags || {};
    const result = [];
    for (let canon of Object.keys(tags).sort()) {
      if (
        !(
          (Session.equals("currentPage", "blackboard") &&
            (canon === "status" ||
              (this.type !== "rounds" && canon === "answer"))) ||
          ((Session.equals("currentPage", "puzzle") ||
            Session.equals("currentPage", "logistics_page")) &&
            (canon === "answer" || canon === "backsolve"))
        )
      ) {
        const t = tags[canon];
        result.push({
          _id: `${this.id}/${canon}`,
          name: t.name,
          canon,
          value: t.value,
          touched_by: t.touched_by,
        });
      }
    }
    return result;
  },
  tagAddClass() {
    const val = Template.instance().newTagName.get();
    if (!val) {
      return "error";
    }
    const cval = canonical(val);
    if (collection(this.type).findOne({ _id: this.id }).tags[cval] != null) {
      return "error";
    }
    return "success";
  },
  tagAddStatus() {
    const val = Template.instance().newTagName.get();
    if (!val) {
      return "Cannot be empty";
    }
    const cval = canonical(val);
    if (collection(this.type).findOne({ _id: this.id }).tags[cval] != null) {
      return "Tag already exists";
    }
  },
});
