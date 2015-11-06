var Parser = require("simple-text-parser"),
    parser = new Parser();

var fs = require("fs");

var result;

// this finds whole entries.
// regex explanation:
//      (date + newline) + (any text/newlines, lazy) + (date + newline OR end of string, lookahead) 
parser.addRule(/[\d-]+\r\n\r\n[\s\S]+?(?=([\d-]+\r\n\r\n)|$)/g, function(entry) {
  //clean up newlines within entry
  entry = entry.replace(/\r\n\r\n/g, '\n');
  return { 
    type: "entry",
    date: "",
    text: entry.trim()
  };
});

fs.readFile('sourceText/ohlife_20141012-sanitized.txt', 'utf8', function (err, data) {
  if (err) {
    result = err;
  }
  result = parser.toTree(data);
  console.log(result.slice(0,10));
});
