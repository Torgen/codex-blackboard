/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import { fileType } from './mime_type.coffee';
import chai from 'chai';

describe('fileType', function() {
  it('capitalizes audio', () => chai.assert.equal(fileType('audio/mp3'), 'MP3 Audio'));

  it('capitalizes video', () => chai.assert.equal(fileType('video/avi'), 'AVI Video'));

  it('capitalizes image', () => chai.assert.equal(fileType('image/svg+xml'), 'SVG Image'));

  it('drops charset', () => chai.assert.equal(fileType('text/plain;charset=UTF-8'), 'Text File'));

  it('capitalizes Google ', () => chai.assert.equal(fileType('application/vnd.google-apps.jam'), 'Google Jam'));

  return it('blats unknown', () => chai.assert.equal(fileType('application/octet-stream'), 'application/octet-stream File'));
});
