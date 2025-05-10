import { chunk_text } from "./imports/chunk_text.js";
import { collection, pretty_collection } from "/lib/imports/collections.js";
import "./imports/ui/components/room_presence";

Template.text_chunks.helpers({
  chunks() {
    return chunk_text(this);
  },
});

Template.text_chunk_room.onCreated(function () {
  this.autorun(() => {
    const data = Template.currentData();
    this.subscribe("presence-for-room", `${data.type}/${data.id}`);
  });
});

Template.text_chunk_room.helpers({
  object() {
    if (this.type === "general") {
      return;
    }
    return collection(this.type).findOne({ _id: this.id });
  },
  pretty_collection,
  room_name() {
    return `${this.type}/${this.id}`;
  },
});

Template.text_chunk_url_image.helpers({
  image(url) {
    return url.match(/(\.|format=)(png|jpg|jpeg|gif)$/i);
  },
});
