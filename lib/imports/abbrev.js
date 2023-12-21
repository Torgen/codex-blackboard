const special = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  zero: "0",
  at: "@",
  with: "w",
  of: "/",
  and: "&",
};

function depunctuate(word) {
  const nw = word.replace(/[^a-zA-Z0-9]/g, "");
  if (nw.length) {
    return nw;
  }
  return word;
}

export default function (txt) {
  let wd;
  if (!txt) {
    return txt;
  }
  const wds = txt.split(/[ ,.]/);
  let fw = [];
  for (wd of wds) {
    const l = wd.toLowerCase();
    if (!l.length || l === "a" || l === "an" || l === "the") {
      continue;
    }
    fw.push(l);
  }
  if (fw.length === 0) {
    fw = wds;
  }
  if (fw.length === 1) {
    wd = depunctuate(fw[0]);
    return wd.substring(0, 1).toUpperCase() + wd.substring(1, 3).toLowerCase();
  }
  const inits = [];
  for (wd of fw) {
    const x = special[wd.toLowerCase()];
    if (x) {
      inits.push(x);
    } else {
      inits.push(depunctuate(wd).substring(0, 1).toUpperCase());
    }
  }
  return inits.join("");
}
