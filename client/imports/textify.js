// Convert an HTML string to plain text
export default function (string) {
  const div = document.createElement("div");
  div.innerHTML = string;
  return div.innerText;
}
