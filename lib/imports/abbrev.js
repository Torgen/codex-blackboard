// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let abbrev;
const special = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  zero: '0',
  at: '@',
  with: 'w',
  of: '/',
  and: '&'
};

const depunctuate = function(word) {
  const nw = word.replace(/[^a-zA-Z0-9]/g, '');
  if (nw.length) { return nw; }
  return word;
};

export default abbrev = function(txt) {
  let wd;
  if (!txt) { return txt; }
  const wds = txt.split(/[ ,.]/);
  let fw = (() => {
    const result = [];
    for (wd of wds) {
      const l = wd.toLowerCase();
      if (!l.length || (l === 'a') || (l === 'an') || (l === 'the')) { continue; }
      result.push(l);
    }
    return result;
  })();
  if (fw.length === 0) {
    fw = wds;
  }
  if (fw.length === 1) {
    wd = depunctuate(fw[0]);
    return wd.substring(0,1).toUpperCase() + wd.substring(1, 3).toLowerCase();
  }
  const inits = (() => {
    const result1 = [];
    for (wd of fw) {
      var x;
      if ((x = special[wd.toLowerCase()])) {
        result1.push(x);
      } else {
        result1.push(depunctuate(wd).substring(0, 1).toUpperCase());
      }
    }
    return result1;
  })();
  return inits.join('');
};
