// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
// Convert an HTML string to 
let textify;
export default textify = function(string) {
  const div = document.createElement('div');
  div.innerHTML = string;
  return div.innerText;
};
