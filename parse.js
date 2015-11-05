var Parser = require("simple-text-parser"),
    parser = new Parser();

var fs = require("fs");

var result;

// Define a rule using a regular expression 
parser.addRule(/[\d-]+\r\n\r\n/ig, function(date) {
  var cleanDateString = date.substr(0, date.length - 4);
  return { type: "entryStart", date: cleanDateString };
});

fs.readFile('sourceText/ohlife_20141012-sanitized.txt', 'utf8', function (err, data) {
  if (err) {
    result = err;
  }
  result = parser.toTree(data);
  console.log(result.slice(0,10));
});