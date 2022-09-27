import { getTag } from "/lib/imports/tags.js";
import md5 from "md5";
import colornames from "css-color-names";

export default function colorFromThingWithTags(thing) {
  const c = getTag(thing, "color");
  if (c) {
    return c;
  }
  const hash = md5(thing._id);
  const hue = parseInt(hash.substring(0, 4), 16) % 360;
  const saturation =
    Math.pow(parseInt(hash.substring(4, 6), 16) / 255.0, 0.5) * 100;
  const lightness =
    Math.pow(parseInt(hash.substring(6, 8), 16) / 255.0, 0.5) * 50;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const numToHex = (num) => ("0" + num.toString(16)).slice(-2);

const canvas = document.createElement("canvas");
[canvas.height, canvas.width] = [1, 1];
const ctx = canvas.getContext("2d");

export function cssColorToHex(color) {
  let a, b, g, m, r;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  if ((m = color.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/))) {
    let x;
    if (([x, r, g, b] = m)) {
      return `#${r}${r}${g}${g}${b}${b}`;
    }
  }
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${numToHex(r)}${numToHex(g)}${numToHex(b)}`;
}

const reversecolornames = {};
for (let name in colornames) {
  const color = colornames[name];
  reversecolornames[color] = name;
}
export const hexToCssColor = (hex) => reversecolornames[hex] || hex;
