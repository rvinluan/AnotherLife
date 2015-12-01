var request = require("request-promise");

function encodeSingleQuery(uri) {
    var base = "?noun <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ";
    return base + '<' + uri + '>';
}

function encodeQueryFromArray(arr) {
    var bigString = "";
    for(var i = 0; i < arr.length; i++) {
        bigString += encodeSingleQuery(arr[i]);
        if(i < arr.length - 1) {
            bigString += " .\n";
        }
    }
    return encodeURIComponent(bigString);
}

function getNameOfEndpoint(url, original) {
    if(!url) {
        return {
            original: original,
            swapped: original
        };
    }
    var obj = url.substr(url.lastIndexOf('/')+1);
    return request("http://dbpedia.org/data/"+obj+".json")
    .then(function (data) {
        var parsedData = JSON.parse(data);
        var main = parsedData["http://dbpedia.org/resource/"+obj];
        if(!main) {
            console.log(parsedData);
            name = obj.replace(/_/g, " ");
            return {
                original: original.replace(/_/g, " "),
                swapped: name
            };
        }
        var nObj = main["http://xmlns.com/foaf/0.1/name"];
        var name;
        if(nObj) {
            name = nObj[0].value;
        } else {
            name = obj.replace(/_/g, " ");
        }
        return {
            original: original.replace(/_/g, " "),
            swapped: name
        };
    })
}

function getFromTypes(typesArray) {
    if(typesArray.length === 0) {
        return "";
    } else {
        console.log("types:")
        console.log(typesArray);
    }
    var replaceWith = encodeQueryFromArray(typesArray);
    var baseURL = 
    "http://dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fdbpedia.org&query=SELECT+%3Fnoun+WHERE+%7B+%0D%0A+{{REPLACE_THIS}}+%0D%0A%7D&format=application%2Fsparql-results%2Bjson&CXML_redir_for_subjs=121&CXML_redir_for_hrefs=&timeout=30000&debug=on";
    return request(baseURL.replace("{{REPLACE_THIS}}", replaceWith))
    .then(function (data) {
        var d = JSON.parse(data);
        var newItems = d.results.bindings.map(function (elem) {
            return elem.noun.value;
        });
        return newItems[Math.floor(Math.random() * newItems.length)];
    })
}

function requestEntry(entryName, bDisambiguates) {
    console.log("en::"+entryName);
    var canonName = entryName.replace(/\s/g, "_");
    var thePromise = request("http://dbpedia.org/data/"+canonName+".json")
    .then(function (data) {
        var parsedData = JSON.parse(data),
            main, types;
        if(parsedData) {
            main = parsedData["http://dbpedia.org/resource/"+canonName];
        } else {
            console.log("nothing came back");
            return [];
        }
        if(main) {
            var types = main["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"];
        } else {
            console.log(canonName + " had no main")
            return [];
        }
        if(types) {
            var justURLs = types.map(function (elem) {
                return elem.value;
            })
            var yagos = justURLs.filter(function (elem) {
                return elem.indexOf("yago") !== -1;
            })
            var ontologies = justURLs.filter(function (elem) {
                return elem.indexOf("dbpedia.org/ontology") !== -1;
            })
            if(yagos.length >= 3) {
                return yagos.slice(0,3);
            } else {
                return ontologies.slice(0,3);
            }
        } else {
            var disambiguates = main["http://dbpedia.org/ontology/wikiPageDisambiguates"];
            if(disambiguates) {
                var newItem = disambiguates[disambiguates.length - 1].value;
                var newName;
                if(newItem) {
                    console.log("disambiguates to: "+newItem);
                    newName = newItem.substr(newItem.lastIndexOf('/')+1);
                } else {
                    newName = "";
                }
                return requestEntry(newName, true);
            } else {
                console.log(canonName + " didn't have any types and couldn't disambiguate");
                return [];
            }
        }
    });

    if(bDisambiguates) {
        return thePromise;
    } else {
        return thePromise
        .then(getFromTypes)
        .then(function (url) {
            return getNameOfEndpoint(url, canonName);
        })
        .catch(function (error) {
            console.log("error doing db!");
            console.log(error.message);
            return {
                original: canonName,
                swapped: canonName
            }
        });
    }
}

module.exports = {
    requestEntry: requestEntry,
    getFromTypes: getFromTypes,
    getNameOfEndpoint: getNameOfEndpoint
}
