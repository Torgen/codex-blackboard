import {
  Calendar,
  CalendarEvents,
  Puzzles,
  Rounds
} from "/lib/imports/collections.js";
import { callAs, impersonating } from "./imports/impersonate.js";
import { DO_BATCH_PROCESSING } from "/server/imports/batch.js";
import md5 from "md5";

// if the database is empty on server start, create some sample data.
// (useful during development; disable this before hunt)
const POPULATE_DB_WHEN_RESET =
  !Meteor.settings.production && !Meteor.isProduction;

const SAMPLE_CHATS = [
  {
    nick: "cscott",
    body: "Have we found the coin yet?  Seriously."
  },
  {
    nick: "cscott",
    body: "This is a very very long line which should hopefully wrap and that will show that we're doing all this correctly. Let's keep going here. More and more stuff! Wow."
  },
  {
    nick: "zachary",
    body: "This message won't be a followup, and will have a url https://codexian.us and an image https://memegen.link/doge/much_coverage/very_test.jpg to test those chat features."
  }
];
const SAMPLE_NICKS = [
  {
    _id: "cscott",
    nickname: "cscott",
    real_name: "C. Scott",
    gravatar_md5: md5("user@host.org")
  },
  {
    _id: "zachary",
    nickname: "zachary",
    gravatar_md5: md5("z@x.org")
  },
  {
    _id: "kwal",
    nickname: "kwal",
    real_name: "Kevin Wallace",
    gravatar_md5: md5("kevin@pentabarf.net")
  }
];

Meteor.startup(function () {
  if (
    DO_BATCH_PROCESSING &&
    POPULATE_DB_WHEN_RESET &&
    Rounds.find().count() === 0
  ) {
    // Meteor.call is sync on server!
    console.log("Populating initial puzzle database...");
    console.log("(use production:true in settings.json to disable this)");
    const WHO = "cscott";
    // add some general chats
    for (let chat of SAMPLE_CHATS) {
      chat.room_name = "general/0";
      callAs("newMessage", chat.nick, { body: chat.body });
    }
    // add some user ids
    for (let nick of SAMPLE_NICKS) {
      Meteor.users.insert(nick);
    }

    // Civilization Round, 2011
    impersonating(WHO, function () {
      const civ = Meteor.call("newRound", {
        name: "Civilization",
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/"
      });
      // TODO(torgen): when default meta exists, remvoe/rename it.
      const palimpsest = Meteor.call("newPuzzle", {
        name: "A Modern Palimpsest",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/a_modern_palimpsest/",
        tags: [{ name: "Technology", value: "The Scroll" }]
      });
      const shikakuro = Meteor.call("newPuzzle", {
        name: "Technological Crisis at Shikakuro Farms",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/technological_crisis_at_shikakuro_farms/",
        tags: [{ name: "Technology", value: "Agriculture" }],
        mechanics: ["nikoli_variants"]
      });
      const charm = Meteor.call("newPuzzle", {
        name: "Charm School",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/charm_school/",
        tags: [{ name: "Technology", value: "Exogamy" }]
      });
      const showcase = Meteor.call("newPuzzle", {
        name: "Showcase",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/showcase/",
        tags: [{ name: "Technology", value: "Mathematics" }],
        mechanics: ["runaround"]
      });
      const drafting = Meteor.call("newPuzzle", {
        name: "Drafting Table",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/drafting_table/",
        tags: [{ name: "Technology", value: "Draftsmanship" }],
        mechanics: ["programming"]
      });
      const racking = Meteor.call("newPuzzle", {
        name: "Racking Your Brains",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/racking_your_brains/",
        tags: [{ name: "Technology", value: "The Wheel" }]
      });
      const chant = Meteor.call("newPuzzle", {
        name: "Crowd's Chant",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/crowds_chant/",
        tags: [{ name: "Technology", value: "Gladatorial Combat" }]
      });
      const hints = Meteor.call("newPuzzle", {
        name: "Hints, With A Bit Of Love!",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/hints_with_a_bit_of_love/",
        tags: [{ name: "Technology", value: "...and Literature" }],
        mechanics: ["cryptic_clues"]
      });
      const bank = Meteor.call("newPuzzle", {
        name: "Letter Bank",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/letter_bank/",
        tags: [{ name: "Technology", value: "Plant-Based Ink" }]
      });
      const easy = Meteor.call("newPuzzle", {
        name: "This SHOULD Be Easy",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/this_should_be_easy/",
        tags: [{ name: "Technology", value: "Epic Poetry" }]
      });
      const cute = Meteor.call("newPuzzle", {
        name: "Soooo Cute!",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/soooo_cute/",
        tags: [{ name: "Technology", value: "Procrastinating" }]
      });
      const maths = Meteor.call("newPuzzle", {
        name: "Advanced Maths",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/advanced_maths/",
        tags: [{ name: "Technology", value: "Philosophy" }]
      });
      const potsherds = Meteor.call("newPuzzle", {
        name: "Painted Potsherds",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/painted_potsherds/",
        tags: [{ name: "Technology", value: "Stoneware" }]
      });
      const cheaters = Meteor.call("newPuzzle", {
        name: "Cheaters Never Prosper",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/cheaters_never_prosper/",
        tags: [{ name: "Technology", value: "Legal System" }]
      });
      const doors = Meteor.call("newPuzzle", {
        name: "The Doors Of Cambridge",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/the_doors_of_cambridge/",
        tags: [{ name: "Technology", value: "Doors" }]
      });
      const literary = Meteor.call("newPuzzle", {
        name: "Literary Collection",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/literary_collection/",
        tags: [{ name: "Technology", value: "Literacy" }]
      });
      const amateur = Meteor.call("newPuzzle", {
        name: "Amateur Hour",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/amateur_hour/",
        tags: [{ name: "Technology", value: "Alchemy" }]
      });
      const box = Meteor.call("newPuzzle", {
        name: "Puzzle Box",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/puzzle_box/",
        tags: [{ name: "Technology", value: "Invention" }],
        mechanics: ["video_game"]
      });
      const magic = Meteor.call("newPuzzle", {
        name: "Sufficiently Advanced Technology",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/sufficiently_advanced_technology/",
        tags: [{ name: "Technology", value: "Trading" }]
      });
      const speech = Meteor.call("newPuzzle", {
        name: "Part Of Speech",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/part_of_speech/",
        tags: [{ name: "Technology", value: "Oratory" }]
      });
      const inventory = Meteor.call("newPuzzle", {
        name: "Inventory Quest",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/inventory_query/",
        tags: [{ name: "Technology", value: "Private Property" }],
        mechanics: ["text_adventure"]
      });
      const laureate = Meteor.call("newPuzzle", {
        name: "Laureate",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/laureate/",
        tags: [{ name: "Technology", value: "Carbon Nanotubules" }],
        mechanics: ["crossword", "cryptic_clues"]
      });
      const princesses = Meteor.call("newPuzzle", {
        name: "The Sport Of Princesses",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/the_sport_of_princesses/",
        tags: [{ name: "Technology", value: "Monarchy" }]
      });
      const kids = Meteor.call("newPuzzle", {
        name: "Fascinating Kids",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/fascinating_kids/",
        tags: [{ name: "Technology", value: "Social Clubs" }]
      });
      const granary = Meteor.call("newPuzzle", {
        name: "Granary Of Ur",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/granary_of_ur/",
        puzzles: [
          palimpsest._id,
          shikakuro._id,
          charm._id,
          bank._id,
          easy._id,
          literary._id
        ]
      });
      const workshop = Meteor.call("newPuzzle", {
        name: "Da Vinci's Workshop",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/da_vincis_workshop/",
        puzzles: [
          palimpsest._id,
          drafting._id,
          racking._id,
          cute._id,
          maths._id,
          potsherds._id,
          box._id
        ]
      });
      const wall_street = Meteor.call("newPuzzle", {
        name: "Wall Street",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/wall_street/",
        puzzles: [
          shikakuro._id,
          charm._id,
          drafting._id,
          racking._id,
          chant._id,
          hints._id,
          easy._id,
          maths._id,
          cheaters._id,
          magic._id
        ]
      });
      const elevator = Meteor.call("newPuzzle", {
        name: "Space Elevator",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/space_elevator/",
        puzzles: [
          palimpsest._id,
          shikakuro._id,
          showcase._id,
          chant._id,
          hints._id,
          bank._id,
          cheaters._id,
          doors._id,
          amateur._id,
          speech._id,
          laureate._id
        ]
      });
      const palace = Meteor.call("newPuzzle", {
        name: "Palace of Versailles",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/palace_of_versailles/",
        puzzles: [
          shikakuro._id,
          showcase._id,
          drafting._id,
          bank._id,
          cute._id,
          doors._id,
          amateur._id,
          inventory._id,
          princesses._id
        ]
      });
      const links = Meteor.call("newPuzzle", {
        name: "St. Andrew's Links",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/st_andrews_links/",
        puzzles: [
          chant._id,
          hints._id,
          potsherds._id,
          cheaters._id,
          doors._id,
          speech._id,
          inventory._id,
          kids._id
        ]
      });
      Meteor.call("newPuzzle", {
        name: "Interstellar Spaceship",
        round: civ._id,
        link: "https://www.mit.edu/~puzzle/2011/puzzles/civilization/interstellar_spaceship/",
        puzzles: [
          elevator._id,
          wall_street._id,
          palace._id,
          links._id,
          workshop._id,
          granary._id
        ]
      });
    });

    // Emotion round, 2018
    impersonating(WHO, function () {
      const emotions = Meteor.call("newRound", {
        name: "Emotions and Memories",
        link: "https://web.mit.edu/puzzle/www/2018/full/island/index.html"
      });
      const joy = Meteor.call("newPuzzle", {
        name: "Joy",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/joy.html",
        tags: [
          { name: "Meta Pattern", value: '"Joy Of" books' },
          { name: "Color", value: "yellow" }
        ]
      });
      const sadness = Meteor.call("newPuzzle", {
        name: "Sadness",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/sadness.html",
        tags: [
          { name: "Cares About", value: "Borders" },
          { name: "Color", value: "blue" }
        ]
      });
      const fear = Meteor.call("newPuzzle", {
        name: "Fear",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/fear.html",
        tags: [
          { name: "Meta Pattern", value: "Unique on health and safety page" },
          { name: "Color", value: "purple" }
        ]
      });
      const disgust = Meteor.call("newPuzzle", {
        name: "Disgust",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/disgust.html",
        tags: [{ name: "Color", value: "lime" }]
      });
      const anger = Meteor.call("newPuzzle", {
        name: "Anger",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/anger.html",
        tags: [
          { name: "Cares About", value: "Temperature" },
          { name: "Color", value: "red" }
        ]
      });
      Meteor.call("newPuzzle", {
        name: "Yeah, But It Didn't Work!",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/yeah_but_it_didnt_work.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "2" }]
      });
      Meteor.call("newPuzzle", {
        name: "Warm And Fuzzy",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/warm_and_fuzzy.html",
        feedsInto: [joy._id]
      });
      Meteor.call("newPuzzle", {
        name: "Clueless",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/clueless.html",
        feedsInto: [disgust._id],
        mechanics: ["crossword", "cryptic_clues"]
      });
      Meteor.call("newPuzzle", {
        name: "In Memoriam",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/in_memoriam.html",
        feedsInto: [sadness._id],
        tags: [{ name: "Borders", value: "2" }]
      });
      Meteor.call("newPuzzle", {
        name: "Freak Out",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/freak_out.html",
        feedsInto: [fear._id],
        mechanics: ["music_identification"]
      });
      Meteor.call("newPuzzle", {
        name: "Let's Get Ready To Jumble",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/lets_get_ready_to_jumble.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "11" }],
        mechanics: ["creative_submission"]
      });
      Meteor.call("newPuzzle", {
        name: "AKA",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/aka.html",
        feedsInto: [disgust._id]
      });
      Meteor.call("newPuzzle", {
        name: "Unfortunate AI",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/unfortunate_al.html",
        feedsInto: [sadness._id],
        tags: [{ name: "Borders", value: "4" }]
      });
      Meteor.call("newPuzzle", {
        name: "A Learning Path",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/a_learning_path.html",
        feedsInto: [disgust._id, fear._id],
        mechanics: ["nikoli_variants"]
      });
      Meteor.call("newPuzzle", {
        name: "Cross Words",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/cross_words.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "1" }],
        mechanics: ["crossword"]
      });
      Meteor.call("newPuzzle", {
        name: "We Are All Afraid To Die",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/we_are_all_afraid_to_die.html",
        feedsInto: [fear._id]
      });
      Meteor.call("newPuzzle", {
        name: "Temperance",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/temperance.html",
        feedsInto: [anger._id, disgust._id],
        tags: [{ name: "Temperature", value: "10" }]
      });
      Meteor.call("newPuzzle", {
        name: "Word Search",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/word_search.html",
        feedsInto: [fear._id, sadness._id],
        tags: [{ name: "Borders", value: "4" }]
      });
      Meteor.call("newPuzzle", {
        name: "Just Keep Swiping",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/just_keep_swiping.html",
        feedsInto: [disgust._id]
      });
      Meteor.call("newPuzzle", {
        name: "Caged",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/caged.html",
        feedsInto: [joy._id, sadness._id],
        tags: [{ name: "Borders", value: "5" }],
        mechanics: ["crossword"]
      });
      Meteor.call("newPuzzle", {
        name: "Minority Report",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/minority_report.html",
        feedsInto: [disgust._id]
      });
      Meteor.call("newPuzzle", {
        name: "Asteroids",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/asteroids.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "3" }],
        mechanics: ["video_game"]
      });
      Meteor.call("newPuzzle", {
        name: "Good Fences Make Sad and Disgusted Neighbors",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/good_fences_make_sad_and_disgusted_neighbors.html",
        feedsInto: [sadness._id, disgust._id],
        tags: [{ name: "Borders", value: "2" }],
        mechanics: ["nikoli_variants"]
      });
      Meteor.call("newPuzzle", {
        name: "Face Your Fears",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/face_your_fears.html",
        feedsInto: [fear._id]
      });
      Meteor.call("newPuzzle", {
        name: "Scattered and Absurd",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/scattered_and_absurd.html",
        feedsInto: [anger._id, sadness._id],
        tags: [
          { name: "Temperature", value: "8" },
          { name: "Borders", value: "3" }
        ]
      });
      Meteor.call("newPuzzle", {
        name: "Cooking a Recipe",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/cooking_a_recipe.html",
        feedsInto: [joy._id, disgust._id]
      });
      Meteor.call("newPuzzle", {
        name: "Roadside America",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/roadside_america.html",
        feedsInto: [fear._id, anger._id],
        tags: [{ name: "Temperature", value: "6" }]
      });
      Meteor.call("newPuzzle", {
        name: "Crossed Paths",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/crossed_paths.html",
        feedsInto: [joy._id],
        mechanics: ["crossword"]
      });
      Meteor.call("newPuzzle", {
        name: "On the A Line",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/clueless.html",
        feedsInto: [disgust._id]
      });
      Meteor.call("newPuzzle", {
        name: "What's In a Name?",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/whats_in_a_name.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "9" }]
      });
      Meteor.call("newPuzzle", {
        name: "Games Club",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/games_club.html",
        feedsInto: [sadness._id],
        tags: [{ name: "Borders", value: "5" }]
      });
      Meteor.call("newPuzzle", {
        name: "Birds of a Feather",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/birds_of_a_feather.html",
        feedsInto: [joy._id, anger._id],
        tags: [{ name: "Temperature", value: "12" }]
      });
      Meteor.call("newPuzzle", {
        name: "Nobody Likes Sad Songs",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/nobody_likes_sad_songs.html",
        feedsInto: [sadness._id],
        tags: [{ name: "Borders", value: "2" }],
        mechanics: ["music_identification"]
      });
      Meteor.call("newPuzzle", {
        name: "Irritating Places",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/irritating_places.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "4" }]
      });
      Meteor.call("newPuzzle", {
        name: "What The...",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/what_the.html",
        feedsInto: [joy._id, fear._id]
      });
      Meteor.call("newPuzzle", {
        name: "Beast Workshop",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/beast_workshop.html",
        feedsInto: [disgust._id]
      });
      Meteor.call("newPuzzle", {
        name: "That Time I Somehow Felt Incomplete",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/that_time_i_somehow_felt_incomplete.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "7" }]
      });
      Meteor.call("newPuzzle", {
        name: "Jeopardy!",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/jeopardy.html",
        feedsInto: [fear._id]
      });
      Meteor.call("newPuzzle", {
        name: "Chemistry Experimentation",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/chemistry_experimentation.html",
        feedsInto: [anger._id],
        tags: [{ name: "Temperature", value: "5" }]
      });
      Meteor.call("newPuzzle", {
        name: "The Brainstorm",
        round: emotions._id,
        link: "https://web.mit.edu/puzzle/www/2018/full/puzzle/the_brainstorm.html",
        mechanics: ["runaround"]
      });
    });

    // fake calendar
    Calendar.insert({ _id: "fake" });
    CalendarEvents.insert({
      _id: "fake1",
      summary: "Create test data",
      start: Date.now() - 3600000,
      end: Date.now() + 3600000,
      location: "The Cloud"
    });
    CalendarEvents.insert({
      _id: "fake2",
      summary: "Do the Brainstorm runaround",
      puzzle: Puzzles.findOne({ canon: "the_brainstorm" })._id,
      start: Date.now() + 1200000,
      end: Date.now() + 3000000
    });

    console.log("Done populating initial database.");
  }
});
