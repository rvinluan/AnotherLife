var Parser = require("simple-text-parser"),
    parser = new Parser();

var fs = require("fs");

var result;

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
  // (date + newline) + (any text/newlines, lazy) + (date + newline OR end of string, lookahead) 
  entry: /[\d-]+\r\n\r\n[\s\S]+?(?=([\d-]+\r\n\r\n)|$)/g,
}

parser.addRule(RegExps.entry, function(entry) {
  //clean up newlines within entry
  //separate the date
  var date = entry.match(RegExps.date);
  console.log(date);
  entry = entry.replace(/\r\n\r\n/g, '\n');
  return { 
    type: "entry",
    date: date,
    text: entry.trim()
  };
});

fs.readFile('sourceText/ohlife_20141012-sanitized.txt', 'utf8', function (err, data) {
  if (err) {
    result = err;
  }
  result = parser.toTree(data);
  console.log(result.slice(0,1));
});
