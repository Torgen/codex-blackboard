import { chunk_text } from "./imports/chunk_text.js";
import { collection, pretty_collection } from "/lib/imports/collections.js";
import { findByChannel } from "/client/imports/presence_index.js";

Template.text_chunks.helpers({
  chunks() {
    return chunk_text(this);
  },
});

Template.text_chunk_room.onCreated(function () {
  this.autorun(() => {
    const data = Template.currentData();
    console.log(data);
    this.subscribe("presence-for-room", `${data.type}/${data.id}`);
  });
});

Template.text_chunk_room.helpers({
  object() {
    return collection(this.type).findOne({ _id: this.id });
  },
  pretty_collection,
  jitsi() {
    const c = findByChannel(`${this.type}/${this.id}`, { jitsi: { $gt: 0 } });
    console.log(c.fetch());
    return c;
  },
  chat_only() {
    return findByChannel(`${this.type}/${this.id}`, { jitsi: 0 });
  },
});

Template.text_chunk_url_image.helpers({
  image(url) {
    return url.match(/(\.|format=)(png|jpg|jpeg|gif)$/i);
  },
});

Template.dynamic_no_whitespace.helpers({
  chooseTemplate(name) {
    return Blaze._getTemplate(name, () => Template.instance());
  },
});
