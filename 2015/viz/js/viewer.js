var margin = {top: 10, right: 2, bottom: 2, left: 12};
var width = 1010 - margin.left - margin.right;
var height = 900 - margin.top - margin.bottom;

var svg = d3.select("#bracket")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
;

var playerNameElement = d3.select("#player-name");
var bracketCodeElement = d3.select("#bracket-code");

var depthValues = {
    4: {
        4: 1,
        3: 1,
        2: 3,
        1: 6
    },
    5: {
        5: 1,
        4: 1,
        3: 3,
        2: 6,
        1: 10
    },
    6: {
        6: 1,
        5: 1,
        4: 3,
        3: 6,
        2: 10,
        1: 15
    },
    7: {
        7: 1,
        6: 1,
        5: 3,
        4: 6,
        3: 10,
        2: 15,
        1: 21
    }
};

function formatUnits(count, units) {
    if (count === 0)      return count + ' ' + units['zero'];
    else if (count === 1) return count + ' ' + units['one'];
    else                  return count + ' ' + units['many'];
}

var xScale = d3.scale.ordinal()
    .rangeBands([width, 0], 0.2, 0)
;

var yScale = d3.scale.ordinal()
    .rangeBands([0, height], 0.1, 0)
;

var regionColor = d3.scale.ordinal()
    .range([
        "#6c71c4",
        "#b58900",
        "#2aa198",
        "#d33682"
    ])
;


// Create the diagonal function for drawing the connectors between team boxes.
// We have to swap all the x and y values here to make the connectors look
// right. See http://stackoverflow.com/questions/15007877/how-to-use-the-d3-diagonal-function-to-draw-curved-lines.
var diagonal = d3.svg.diagonal()
    .source(function(d) {
        return {
            y: xScale(d.depth) + xScale.rangeBand(),
            x: yScaleCenter(d.breadth)
        };
    })
    .target(function(d) {
        return {
            y: xScale(d.parent.depth),
            x: yScaleCenter(d.parent.breadth)
        };
    })
    .projection(function(d) {
        return [d.y, d.x];
    })
;

var treeBracket = {};
var flatBracket = [];
var teams = [];
var numTeams = 0;
var numRounds = 0;
var regions = Object.create(null);  // Implement a Set using a blank Object.

function createTreeBracket(bracket, nodeId, parent) {
    var node = {};

    node.parent = parent;

    if ('team' in bracket[nodeId]) {
        node.team = bracket[nodeId].team;
    }
    else {
        node.team = "";
    }

    if ('region' in bracket[nodeId]) {
        node.region = bracket[nodeId].region;
    }
    else {
        node.region = null;
    }

    if ('children' in bracket[nodeId]) {
        node.children = [
            createTreeBracket(bracket, bracket[nodeId].children[0], node),
            createTreeBracket(bracket, bracket[nodeId].children[1], node)
        ];
    }
    else {
        node.children = null;
    }

    return node;
}

function assignBracketDimensions(node, currentDepth) {
    node.depth = currentDepth;

    if (node.children === null) {
        // This is a leaf node.
        teams.push(node.team);
        node.breadth = teams.length;
    }
    else {
        node.children.forEach(function(child) {
            assignBracketDimensions(child, node.depth + 1);
        });
        node.breadth = d3.mean(node.children, function(child) {
            return child.breadth;
        });
    }

    if (node.region !== null) {
        regions[node.region] = true;
    }

    numRounds = Math.max(numRounds, node.depth);
}

function flattenBracket(node, flat) {
    if (node.children !== null) {
        node.children.forEach(function(child) { flattenBracket(child, flat); });
    }
    flat.push(node);
}

function yScaleCenter(y) {
    // Assume the yScale isn't reversed. That is, assume
    // yScale(y+a) > yScale(y) for a > 0.

    var prevCenter = yScale(Math.floor(y)) + yScale.rangeBand()/2;
    var nextCenter = yScale(Math.ceil(y)) + yScale.rangeBand()/2;
    var step = nextCenter - prevCenter;
    var fraction = y - Math.floor(y);
    var thisCenter = prevCenter + fraction * step;
    return thisCenter;
}

function setHovering(node) {
    flatBracket.filter(function(d) {
        return d.team === node.team;
    }).forEach(function(d) {
        d.hovering = true;
    });
}

function unsetHovering(node) {
    flatBracket.forEach(function(d) {
        d.hovering = false;
    });
}

function restyleHovering() {
    d3.selectAll(".team-box")
        .classed("hovering", function(d) { return d.hovering; })
    ;
    d3.selectAll(".link")
        .classed("hovering", function(d) { return d.hovering; })
    ;
}


var bracketTeamsCode = "";

function parseBracketCode(bracketCode) {
    var parts = bracketCode.split('#');
    if (parts.length >= 2) {
        return {
            "teams": parts[0],
            "points": parts[1]
        };
    }
    else {
        return {
            "teams": parts[0],
            "points": null
        };
    }
}

function applyBracketCode(code) {
    var bracketCodeParts = parseBracketCode(code);

    var rawBracketTeamsCode = bracketCodeParts["teams"];

    if (rawBracketTeamsCode.length !== teams.length) {
        alert("Invalid bracket code: Incorrect number of characters.");
        return;
    }

    bracketTeamsCode = rawBracketTeamsCode;

    var teamCounts = bracketTeamsCode.split('');

    flatBracket.forEach(function(node) {
        if (node.children !== null) {
            node.team = "";
        }
    });

    flatBracket.forEach(function(node) {
        if (node.children === null) {
            var team = node.team;
            var count = teamCounts[teams.indexOf(team)];
            var parent = node.parent;
            while (count > 0) {
                if (parent === null || parent.team !== "") {
                    alert("Invalid bracket code!");
                    return;
                }
                parent.team = team;
                parent = parent.parent;
                count--;
            }
        }
    });

    bracketCodeElement.text(code);
}

// Use the key's bracket code to mark all the games as right, wrong, or
// unplayed. We'll add an attribute named right to the bound data. right=true
// means the pick was right, right=false means the pick was wrong, and
// right=null means the game is unplayed.

function applyKeyBracketCode(code) {
    var bracketCodeParts = parseBracketCode(code);
    var teamsCode = bracketCodeParts["teams"];

    if (teamsCode.length !== teams.length) {
        alert("Invalid key bracket code: Incorrect number of characters.");
        return;
    }

    var teamCounts = teamsCode.split('');

    // Add the attribute to all the nodes that represent picks, and initialize
    // it to null.

    flatBracket.filter(function(node) {
        return node.children !== null;
    }).forEach(function(node) {
        node.right = null;
    });

    // The key's bracket code tells us how many games each team has won. For
    // each leaf node (team), step through the number of games the team should
    // have won and verify that the predicted bracket matches that team.

    flatBracket.filter(function(node) {
        return node.children === null;
    }).forEach(function(node) {
        var team = node.team;
        var count = teamCounts[teams.indexOf(team)];
        var parent = node.parent;

        while (count > 0) {
            if (parent === null) {
                alert("Invalid key bracket code!");
                return;
            }

            checkRight(parent, team);
            parent = parent.parent;
            count--;
        }
    });
}

// Check whether the node represents a correct pick. Mark it right if so and
// wrong if not. If wrong, mark all later appearances of the team as wrong.

function checkRight(node, team) {
    if (node.team === team) {
        node.right = true;
    }
    else {
        node.right = false;
        propagateWrong(node.parent, node.team);
    }
}

// Mark the node wrong if it matches the given team. Then pass the same logic on
// to the parent node (the next round). There is no need to move to the parent
// node if this node doesn't match the given team, because in that case the
// given team can't appear anywhere later in the bracket.

function propagateWrong(node, team) {
    if (node === null) return;

    if (node.team === team) {
        node.right = false;
        propagateWrong(node.parent, team);
    }
}

function createBracket(options) {
    var q = queue()
        .defer(d3.json, "../data/entry.json")
        .defer(d3.csv, "../data/bracket_code_key.csv")
    ;

    q.await(function(error, inputBracket, keyData) {
        treeBracket = createTreeBracket(inputBracket, "root", null);
        assignBracketDimensions(treeBracket, 1);
        flattenBracket(treeBracket, flatBracket);

        flatBracket.map(function(node) {
            node.value = depthValues[numRounds][node.depth];
            node.hovering = false;
            node.pending = false;
        });

        playerNameElement.text(options.name);
        applyBracketCode(options.code);
        applyKeyBracketCode(keyData[0]['code']);

        xScale.domain(d3.range(1, numRounds + 1));
        yScale.domain(d3.range(1, teams.length + 1));
        regionColor.domain(d3.keys(regions));

        svg.selectAll(".link")
            .data(flatBracket)
            .enter()
            .append("path")
            .filter(function(d) { return d.parent !== null; })
            .classed("link", true)
            .attr("d", function(d) { return diagonal(d); })
        ;

        var teamBoxes = svg.selectAll(".team-box")
            .data(flatBracket)
            .enter()
            .append("g")
            .attr("transform", function(d) {
                return "translate(" +
                    xScale(d.depth) +
                    "," +
                    (yScaleCenter(d.breadth) - (d.value * yScale.rangeBand() / 2)) +
                    ")";
            })
            .classed("team-box", true)
            .classed("right", function(d) { return d.right === true; })
            .classed("wrong", function(d) { return d.right === false; })
            .classed("incomplete", function(d) { return d.team === ""; })
            .on("mouseover", function(d) {
                if (d.team === "") return;
                setHovering(d);
                restyleHovering();
            })
            .on("mouseout", function(d) {
                if (d.team === "") return;
                unsetHovering(d);
                restyleHovering();
            })
        ;

        teamBoxes
            .append("rect")
            .attr("width", xScale.rangeBand())
            .attr("height", function(d) { return d.value * yScale.rangeBand(); })
            .classed("team-rect", true)
        ;

        teamBoxes
            .filter(function(d) { return d.children === null; })
            .append("rect")
            .attr("x", -10)
            .attr("width", 8)
            .attr("height", function(d) { return d.value * yScale.rangeBand(); })
            .attr("fill", function(d, i) {
                // Color the boxes based on the region. Use this method to give all
                // the boxes in the region a uniform color:
                //
                //     return regionColor(d.region);
                //
                // Use this method to alternate between the assigned color and a
                // lighter version:
                //
                //     if (i % 2 === 0) return regionColor(d.region);
                //     else return d3.rgb(regionColor(d.region)).brighter();
                //
                // Use this method to alternate between the assigned color and a
                // lighter version for every pair of teams:
                //
                if (Math.floor(i/2) % 2 === 0) return regionColor(d.region);
                else return d3.rgb(regionColor(d.region)).brighter();
            })
        ;

        teamBoxes
            .append("text")
            .classed("team-text", true)
            .attr("x", "0.25em")
            .attr("y", function(d) { return d.value * yScale.rangeBand() / 2; })
            .attr("text-anchor", "start")
            .style("dominant-baseline", "middle")
            .text(function(d) { return d.team; })
        ;


    });
}
