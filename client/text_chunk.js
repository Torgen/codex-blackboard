// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import {chunk_text} from './imports/chunk_text.coffee';

Template.text_chunks.helpers({
  chunks() { return chunk_text(this); }});

Template.text_chunk_url_image.helpers({
  image(url) { return url.match(/(\.|format=)(png|jpg|jpeg|gif)$/i); }});

Template.dynamic_no_whitespace.helpers({
  chooseTemplate(name) {
    return Blaze._getTemplate(name, () => Template.instance());
  }
});
