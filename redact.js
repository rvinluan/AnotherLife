var fs = require("fs");
var source = require("./outputText/run-2__11-30-15-redacted.json");

for(var entry in source) {
    if(source[entry].type == "redacted") {
        source[entry].text = source[entry].text.replace(/\S/g, "x");
    }
}

fs.writeFile("outputText/run-2__11-30-15-redacted.json", JSON.stringify(source), function (error) {
    if(!error) {
        console.log("DONE");
    }
});
