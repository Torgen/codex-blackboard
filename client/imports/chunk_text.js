import { collection } from "/lib/imports/collections.js";

const urlRE =
  /\b(?:[a-z][\w\-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'\".,<>?«»“”‘’])/gi;

const roomRE = /#(general|puzzles|rounds)\/([a-zA-Z0-9]+)/g;

function extractAll(re, ppMatch, ppText) {
  return function (text) {
    const result = [];
    let tail_start = 0;
    for (let match of text.matchAll(re)) {
      if (tail_start < match.index) {
        result.push(...ppText(text.slice(tail_start, match.index)));
      }
      tail_start = match.index + match[0].length;
      result.push(...ppMatch(match));
    }
    if (tail_start < text.length) {
      result.push(...ppText(text.slice(tail_start)));
    }
    return result;
  };
}

const roomify = extractAll(
  roomRE,
  function (match) {
    return [{ type: "room", content: { type: match[1], id: match[2] } }];
  },
  (content) => [{ type: "text", content }]
);

const linkify = extractAll(
  urlRE,
  function (match) {
    const original = match[0];
    let url = match[0];
    if (!/^[a-z][\w\-]+:/.test(url)) {
      url = `http://${url}`;
    }
    return [{ type: "url", content: { url, original } }];
  },
  roomify
);

export function plain_text(text) {
  const chunks = chunk_text(text);
  return chunks
    .map(({ type, content }) => {
      switch (type) {
        case "url":
          return content.url;
        case "break":
          return "\n";
        case "room":
          const obj = collection(content.type)?.findOne(
            { _id: content.id },
            { fields: { name: 1 } }
          );
          if (obj) {
            return obj.name;
          }
          return `#${content.type}/${content.id}`;
        case "mention":
          return `@${content}`;
        default:
          return content;
      }
    })
    .join("");
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
      for (let mention of paragraph.matchAll(/([\s]|^)@([a-zA-Z0-9_]+)/g)) {
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
