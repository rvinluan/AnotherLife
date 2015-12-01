var fs = require("fs");
var source = require("./outputText/run-2__11-30-15.json");

var newText = "";

for(var entry in source) {
    newText += "\n";
    newText += source[entry].date;
    newText += "\n";
    newText += source[entry].text;
    newText += "\n";
}

fs.writeFile("outputText/finalText.txt", newText, function (error) {
    if(!error) {
        console.log("DONE");
    }
});
