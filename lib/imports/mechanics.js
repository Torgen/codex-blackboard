import canonical from "./canonical.js";

export var mechanics = {};

class Mechanic {
  constructor(name) {
    this.name = name;
    this.canon = canonical(this.name);
    mechanics[this.canon] = this;
    Object.freeze(this);
  }
}

new Mechanic("Creative Submission");
new Mechanic("Crossword");
new Mechanic("Cryptic Clues");
new Mechanic("Duck Konundrum");
new Mechanic("High Level Math");
new Mechanic("Knitting/Crocheting");
new Mechanic("Music Identification");
new Mechanic("Nikoli Variants");
new Mechanic("NPL Flats");
new Mechanic("Physical Artifact");
new Mechanic("Place Identification");
new Mechanic("Programming");
new Mechanic("Runaround");
new Mechanic("Scavenger Hunt");
new Mechanic("Text Adventure");
new Mechanic("Video Game");

Object.freeze(mechanics);

export var IsMechanic = Match.Where((x) => mechanics[x] != null);
