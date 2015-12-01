var Parser = require("simple-text-parser"),
    parser = new Parser();

var fs = require("fs");

var Q = require("q");

var node_ner = require('node-ner');

var DBPSQ = require("./sparql.js");

var wordfilter = require("wordfilter");

var ner = new node_ner({
    install_path:   '~/Downloads/stanford-ner-2014-10-26/'
});

var config = require("./config.json");
var foursquare = (require('foursquarevenues'))(
  config.client_id,
  config.client_secret
);

var allNames = require("./names.json");

var result;

var outputData = [];

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
// NAMES!
//
****/
function isNamed(str) {
  for (var name in allNames) {
    if(allNames[name] == str) {
      return true;
    }
  }
  return false;
}

function addNames(arr) {
  for(var n in arr) {
    if(!isNamed(arr[n]) && !arr[n].match(/^\d+$/) && !isNamed(arr[n].split(" ")[0])) {
      allNames.push(arr[n]);
    }
  }
}

function removeNamesFromArray(arr) {
  var newarr = [];
  for(var n in arr) {
    if(!isNamed(arr[n])) {
      newarr.push(arr[n]);
    }
  }
  return newarr;
}

function shuffleNames(arr) {
  var newNames = [];
  for (var n in arr) {
    var newName = allNames[Math.floor(Math.random() * allNames.length)];
    newNames.push({
      original: arr[n],
      swapped: newName
    })
  }
  return newNames;
}

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

  properNoun: /\w (([A-Z][a-z]+[\s|\W])+(?:[A-Z][a-z]+[\s|\W]|of[\s|\W]|[A-Z^I][\s|\W])*)/g
}

//find only the elements in the firstArray that do not exist in the secondArray.
function crossReference(firstArray, secondArray) {
  var newArray = [];
  for(var i = 0; i < firstArray.length; i++) {
    if( secondArray.indexOf(firstArray[i]) == -1 ) {
      newArray.push(firstArray[i]);
    }
  }
  return newArray;
}

function findProperNouns(entryText) {
  var allArray = [],
      matchesArray;
  while( (matchesArray = RegExps.properNoun.exec(entryText)) !== null ) {
    var value = matchesArray[1].substring(0, matchesArray[1].length-1);
    // console.log(value);
    allArray.push(value);
  }
  return allArray;
}

function findProperNounsWithNER(results, currentIndex, allEntryPromises) {
  var workingEntry = results[currentIndex];
  var entryText = workingEntry.text;
  var promisesArray = [];
  fs.writeFileSync("temp.txt", entryText);
  ner.fromFile('temp.txt', function(entities) {
      console.log("NER success!");
      console.log(entities);
      var newPeople, newOrgs, newLocs;
      var capitalizedWords = findProperNouns(entryText);
      capitalizedWords = removeNamesFromArray(capitalizedWords);
      if(entities.PERSON) {
        addNames(entities.PERSON);
        capitalizedWords = crossReference(capitalizedWords, entities.PERSON);
        var newPeople = shuffleNames(entities.PERSON);
      }
      if(entities.ORGANIZATION) {
        var cleanOrgs = removeNamesFromArray(entities.ORGANIZATION);
        capitalizedWords = crossReference(capitalizedWords, entities.ORGANIZATION);
        promisesArray.push(replaceWithFoursquareVenues(cleanOrgs));
      }
      if(entities.LOCATION) {
        var cleanLocs = removeNamesFromArray(entities.LOCATION);
        capitalizedWords = crossReference(capitalizedWords, entities.LOCATION);
        promisesArray.push(replaceWithFoursquareVenues(cleanLocs));
      }

      promisesArray.push(replaceViaWikipedia(capitalizedWords));

      var finalPromise = Q.all(promisesArray).then(function (results) {
        if(newPeople) {
          results.push(newPeople);
        }
        for(var replacements in results) {
          for(var swap in results[replacements]) {
            var obj = results[replacements][swap];
            var replacementRegex = new RegExp(obj.original+'(?=[\\s\\W])', 'g');
            var filteredWord = wordfilter.blacklisted(obj.swapped) ? obj.original : obj.swapped;
            filteredWord = decodeURIComponent(filteredWord);
            workingEntry.text = workingEntry.text.replace(replacementRegex, filteredWord);
          }
        }
        //replace all numbers
        workingEntry.text = replaceNumbers(workingEntry.text);
        return workingEntry;
      });

      if(currentIndex < results.length - 1) {
        allEntryPromises.push(finalPromise);
        findProperNounsWithNER(results, currentIndex+1, allEntryPromises);
      } else {
        allEntryPromises.push(finalPromise);
        Q.all(allEntryPromises).then(function (allEntries) {
          console.log("DONE");
          fs.writeFileSync("outputText/outputText.json", JSON.stringify(allEntries));
        })
        .catch(function (error) {
          console.log("ERROR!!!----")
          console.log(error);
        })
      }
  });
}

function replaceNumbers(text) {
  var matches = text.match(/\d+/g),
      newText = text;
  for(sequence in matches) {
    var n = matches[sequence],
        newNumber = "";
    //safeguard against times...wonky but safe
    if(n == "10" || n == "11" || n == "12") {
      continue;
    }
    for(var i = 0; i < n.length; i++) {
      newNumber += "1234567890".split("")[Math.floor(Math.random()*10)];
    }
    var newText = text.replace(n, newNumber);
  }
  return newText;
}

function replaceViaWikipedia(thingsArray) {
  var promisesArray = [];
  for(var i in thingsArray) {
    var wPromise = DBPSQ.requestEntry(thingsArray[i]);
    promisesArray.push(wPromise);
  } //end for loop

  return Q.all(promisesArray);
}

function replaceWithFoursquareVenues(thingsArray) {
  var promisesArray = [];
  var originalName;
  for(var i in thingsArray) {
    originalName = thingsArray[i];
    var params = {
      "ll": "40.7127, -74.0059",
      "query": originalName
    };

    var fsPromise = foursquare.getVenues(params)
    .then(function(venues) {
      var r = JSON.parse(venues).response;
      if (r.venues.length > 0) {
        return r.venues[0].id;
      } else {
        throw new Error("couldn't find a matching venue in Foursquare");
      }
    })
    .then(foursquare.getSimilarVenue)
    .then(function(venues){
      var r = JSON.parse(venues).response;
      if(r.similarVenues.count > 0) {
        var rand = Math.floor(Math.random() * r.similarVenues.count);
        var newName = r.similarVenues.items[rand].name;
        console.log(originalName + "-->" + newName);
        return {
          original: originalName,
          swapped: newName
        }; 
      } else {
        return {
          original: originalName,
          swapped: originalName
        }; 
      }
    })
    .catch(function(error){
      console.log(error.message);
      return Q({
        original: originalName,
        swapped: originalName
      });
    });

    promisesArray.push(fsPromise);
  }//end for loop

  return Q.all(promisesArray);
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
  findProperNounsWithNER(result, 0, []);
  // var n = DBPSQ.requestEntry("Bastion");
  // n.then(function (d) {
  //   console.log(d);
  // })
});
