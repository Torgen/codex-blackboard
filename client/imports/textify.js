// Convert an HTML string to 
let textify;
export default textify = function(string) {
  const div = document.createElement('div');
  div.innerHTML = string;
  return div.innerText;
};
