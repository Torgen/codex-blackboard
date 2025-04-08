function lengthBefore(node) {
  let result = 0;
  while ((node = node.previousSibling) != null) {
    if (node.nodeType == Node.TEXT_NODE) {
      result += node.nodeValue.length;
    } else if (node instanceof HTMLBRElement) {
      result += "\n".length;
    } else {
      throw new Error(`Unexpected node ${node}`);
    }
  }
  return result;
}

/**
 * @param {HTMLElement} editable Element with contenteditable="plaintext-only"
 * @returns {Array[Number]?} null if the selection isn't only in the element, or [start, end] if it is.
 */
export function selectionWithin(editable) {
  const sel = document.getSelection();
  const an = sel.anchorNode;
  const fo = sel.focusNode;
  if (an === null || (an === editable && fo == editable)) {
    const v = editable.innerText;
    return [v.length, v.length];
  }
  if (an.parentElement === editable && fo.parentElement === editable) {
    console.log(`an ${an} fo ${fo}`);
    const anchorOffset = sel.anchorOffset + lengthBefore(an);
    const focusOffset = sel.focusOffset + lengthBefore(fo);
    console.log(`an ${anchorOffset} fo ${focusOffset}`);
    return [
      Math.min(anchorOffset, focusOffset),
      Math.max(anchorOffset, focusOffset),
    ];
  }
  return null;
}

/**
 * Set selection
 * @param {HTMLElement} element Element with contenteditable="plaintext-only"
 * @param {Number} anchor start of selection range
 * @param {Number?} focus end of selection range. If unset, same as anchor.
 */
export function selectWithin(element, anchor, focus = anchor) {
  const sel = document.getSelection();
  sel.empty();
  let node = element.childNodes[0];
  let anchorNode, focusNode;
  while (!anchorNode || !focusNode) {
    if (node.nodeType == Node.TEXT_NODE) {
      if (!anchorNode) {
        if (anchor <= node.nodeValue.length) {
          anchorNode = node;
        } else {
          anchor -= node.nodeValue.length;
        }
      }
      if (!focusNode) {
        if (focus <= node.nodeValue.length) {
          focusNode = node;
        } else {
          focus -= node.nodeValue.length;
        }
      }
    } else if (node instanceof HTMLBRElement) {
      if (!anchorNode) {
        if (anchor == 0) {
          anchorNode = node;
        } else {
          anchor -= 1;
        }
      }
      if (!focusNode) {
        if (focus == 0) {
          focusNode = node;
        } else {
          focus -= 1;
        }
      }
    } else {
      throw new Error(`Unexpected node ${node}`);
    }
    node = node.nextSibling;
  }
  sel.setBaseAndExtent(anchorNode, anchor, focusNode, focus);
}
