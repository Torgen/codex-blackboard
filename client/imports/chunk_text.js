const urlRE =
  /\b(?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'\".,<>?«»“”‘’])/gi;

function linkify(text) {
  const result = [];
  let tail_start = 0;
  for (let match of text.matchAll(urlRE)) {
    if (tail_start < match.index) {
      result.push({
        type: "text",
        content: text.slice(tail_start, match.index),
      });
    }
    tail_start = match.index + match[0].length;
    const original = match[0];
    let url = match[0];
    if (!/^[a-z][\w\-]+:/.test(url)) {
      url = `http://${url}`;
    }
    result.push({ type: "url", content: { url, original } });
  }
  if (tail_start < text.length) {
    result.push({ type: "text", content: text.slice(tail_start) });
  }
  return result;
}

export function chunk_text(text) {
  if (!text) {
    return [];
  }
  let to_prepend = [];
  const br = [{ type: "break", content: "" }];
  const result = [];
  // Pass 1: newlines
  for (let paragraph of text.split(/\n|\r\n?/)) {
    result.push(...to_prepend);
    to_prepend = br;
    if (paragraph) {
      // Pass 2: mentions
      let tail_start = 0;
      for (let mention of paragraph.matchAll(/([\s]|^)@([a-zA-Z0-9_]*)/g)) {
        if (mention.index > tail_start || mention[1].length) {
          const interval =
            paragraph.slice(tail_start, mention.index) + mention[1];
          result.push(...linkify(interval));
        }
        result.push({ type: "mention", content: mention[2] });
        tail_start = mention.index + mention[0].length;
      }
      if (tail_start < paragraph.length) {
        result.push(...linkify(paragraph.slice(tail_start)));
      }
    }
  }
  return result;
}

export function chunk_html(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const result = [];
  for (let child of div.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      result.push(...chunk_text(child.textContent));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (result.length && result[result.length - 1].type === "html") {
        result[result.length - 1].content += child.outerHTML;
      } else {
        result.push({ type: "html", content: child.outerHTML });
      }
    }
  }
  return result;
}
