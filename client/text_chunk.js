import { chunk_text } from "./imports/chunk_text.js";

Template.text_chunks.helpers({
  chunks() {
    return chunk_text(this);
  }
});

Template.text_chunk_url_image.helpers({
  image(url) {
    return url.match(/(\.|format=)(png|jpg|jpeg|gif)$/i);
  }
});

Template.dynamic_no_whitespace.helpers({
  chooseTemplate(name) {
    return Blaze._getTemplate(name, () => Template.instance());
  }
});
