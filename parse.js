var Parser = require("simple-text-parser"),
    parser = new Parser();

var fs = require("fs");

var result;

//via https://gist.github.com/karbassi/6216484
String.prototype.smarten = function () {
    return this
        /* opening singles */
        .replace(/(^|[-\u2014\s(\["])'/g, "$1\u2018")

        /* closing singles & apostrophes */
        .replace(/'/g, "\u2019")

        /* opening doubles */
        .replace(/(^|[-\u2014/\[(\u2018\s])"/g, "$1\u201c")

        /* closing doubles */
        .replace(/"/g, "\u201d")

        /* em-dashes */
        .replace(/--/g, "\u2014");
};

/****
//
// REGEXES!
//
****/

var RegExps = {
  // this finds a date in the format
  // YYYY-MM-DD or similar.
  date: /[\d-]+\r\n\r\n/,

  // this finds whole entries.
  // (date + newline) + (any text/newlines, lazy) + lookahead(date + newline OR end of string) 
  entry: /[\d-]+\r\n\r\n[\s\S]+?(?=([\d-]+\r\n\r\n)|$)/g,

  properNoun: /\w ((?:[A-Z][a-z]+[\s|\W])+)/g
}

function findProperNouns(entryText) {
  var matchesArray;
  while( (matchesArray = RegExps.properNoun.exec(entryText)) !== null ) {
    console.log(matchesArray[1].substring(0, matchesArray[1].length-1));
  }
}

parser.addRule(RegExps.entry, function(entry) {
  //clean up newlines within entry
  //separate the date
  var date = entry.match(RegExps.date)[0];
  entry = entry.replace(RegExps.date, '');
  entry = entry.replace(/\r\n\r\n/g, '\n');
  entry = entry.smarten();
  entry = entry.trim();
  return { 
    type: "entry",
    date: date.substring(0, date.length - 4),
    text: entry.trim()
  };
});

fs.readFile('sourceText/ohlife_20141012-sanitized.txt', 'utf8', function (err, data) {
  if (err) {
    result = err;
  }
  result = parser.toTree(data);
  for(var i in result) {
    findProperNouns(result[i].text);
  }
});
