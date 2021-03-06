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

var codeInput = d3.select("#bracket-code");

d3.select("#bracket-code-apply")
    .on("click", applyBracketCode)
;

var pointsInput = d3.select("#champ-points")
    .on("keyup", refreshBracketPointsCode)
;

var statusMessageField = d3.select("#status-message");

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

// Create a function for drawing the connectors between team boxes. Use an SVG
// Path to draw a series of lines:
//
//   1. Move to the center of the right edge of the box.
//   2. Draw a horizontal line halfway to the parent box.
//   3. Draw a vertical line up or down to the center of the parent box.
//   4. Draw a horizontal line the rest of the way to the parent box.
//
// Note that the line in #4 will be repeated by the two children of each parent.

var connector = function(d) {
    var path = "";
    path += "M" + (xScale(d.depth) + xScale.rangeBand()) + "," + yScaleCenter(d.breadth);
    path += "H" + (xScale(d.depth) + xScale.rangeBand() + xScale(d.parent.depth))/2;
    path += "V" + yScaleCenter(d.parent.breadth);
    path += "H" + xScale(d.parent.depth);
    return path;
}


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

function clearParents(node, value) {
    if (node.parent === null) return;
    if (node.parent.team === "") return;
    if (node.parent.team !== value) return;

    clearParents(node.parent, value);
    node.parent.team = "";
}

function populateParent(node) {
    if (node.parent === null) return;

    clearParents(node, node.parent.team);
    node.parent.team = node.team;
}

function setParentsPending(node, value) {
    if (node.parent === null) return;
    if (node.parent.team === "") return;
    if (node.parent.team !== value) return;

    setParentsPending(node.parent, value);
    node.parent.pending = true;
}

function unsetParentsPending(node) {
    if (node.parent === null) return;

    unsetParentsPending(node.parent);
    node.parent.pending = false;
}

function refreshBoxContent() {
    d3.selectAll(".team-text")
        .text(function(d) { return d.team; })
    ;
    d3.selectAll(".team-box")
        .classed("incomplete", function(d) { return d.team === ""; })
        .style("cursor", function(d) {
            if (d.team === "") return "default";
            if (d.parent === null) return "default";
            if (d.parent.team === d.team) return "default";
            return "pointer";
        })
    ;
}

function restyleHoverPending() {
    d3.selectAll(".team-box")
        .classed("hovering", function(d) { return d.hovering; })
        .classed("pending", function(d) { return d.pending; })
    ;
    d3.selectAll(".link")
        .classed("pending", function(d) {
            if (d.parent === null) return false;
            return (d.hovering || d.pending) && d.parent.pending;
        })
    ;
}


var bracketTeamsCode = "";
var bracketPointsCode = 0;

function buildBracketCode(teamsCode, pointsCode) {
    return [teamsCode, pointsCode].join('#');
}

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

// This assumes 9 or fewer rounds.
function refreshBracketTeamsCode() {
    var teamCounts = {};

    teams.forEach(function(team) { teamCounts[team] = 0; });

    flatBracket.forEach(function(node) {
        if (node.children !== null) {
            teamCounts[node.team]++;
        }
    });

    var countString = teams.map(function(team) { return teamCounts[team]; });
    bracketTeamsCode = countString.join('');

    codeInput.property("value", buildBracketCode(bracketTeamsCode, bracketPointsCode));

    refreshStatusMessage();
}

function applyBracketCode() {
    var bracketCodeParts = parseBracketCode(codeInput.property("value"));

    var rawBracketTeamsCode = bracketCodeParts["teams"];
    var rawBracketPointsCode = bracketCodeParts["points"];

    if (rawBracketTeamsCode.length !== teams.length) {
        alert("Invalid bracket code: Incorrect number of characters.");
        return;
    }
    if (rawBracketPointsCode === null || rawBracketPointsCode === "") {
        alert("Invalid bracket code: Missing point total.");
        return;
    }

    bracketTeamsCode = rawBracketTeamsCode;
    bracketPointsCode = rawBracketPointsCode;

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

    refreshBoxContent();
    refreshStatusMessage();

    pointsInput.property("value", bracketPointsCode);
}

function refreshBracketPointsCode() {
    bracketPointsCode = pointsInput.property("value");
    codeInput.property("value", buildBracketCode(bracketTeamsCode, bracketPointsCode));

    refreshStatusMessage();
}

function refreshStatusMessage() {
    var statusMessages = [];
    var statusErrorLevel = "good";

    var expectedPickCount = teams.length - 1;
    var actualPickCount = d3.sum(bracketTeamsCode.split(''));
    var missingPickCount = expectedPickCount - actualPickCount;

    if (missingPickCount > 0) {
        statusMessages.push("Missing " + formatUnits(missingPickCount, { zero: "picks", one: "pick", many: "picks" }) + ".");
        statusErrorLevel = "error";
    }

    var predictedPoints = parseInt(bracketPointsCode, 10);
    if (predictedPoints === 0 || isNaN(predictedPoints)) {
        statusMessages.push("Missing predicted points in championship game.");
        statusErrorLevel = "error";
    }
    else if (predictedPoints < 90) {
        statusMessages.push("Surprisingly low predicted points in championship game (should be sum of both teams' scores).");
        if (statusErrorLevel !== "error") statusErrorLevel = "warning";
    }

    if (statusErrorLevel === "good") {
        statusMessages.push("Your bracket is complete! Submit it by sending the bracket code to Joey.");
    }

    statusMessageField.text(statusMessages.join(' '));
    statusMessageField.attr("class", statusErrorLevel);
}


d3.json("data/entry.json", function(error, inputBracket) {
    treeBracket = createTreeBracket(inputBracket, "root", null);
    assignBracketDimensions(treeBracket, 1);
    flattenBracket(treeBracket, flatBracket);

    codeInput.attr("size", teams.length + 8);
    refreshBracketTeamsCode();

    pointsInput.property("value", bracketPointsCode);

    refreshStatusMessage();

    flatBracket.map(function(node) {
        node.value = depthValues[numRounds][node.depth];
        node.hovering = false;
        node.pending = false;
    });

    xScale.domain(d3.range(1, numRounds + 1));
    yScale.domain(d3.range(1, teams.length + 1));

    svg.selectAll(".link")
        .data(flatBracket)
        .enter()
        .append("path")
        .filter(function(d) { return d.parent !== null; })
        .classed("link", true)
        .attr("d", function(d) { return connector(d); })
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
        .classed("incomplete", function(d) { return d.team === ""; })
        .style("cursor", function(d) {
            if (d.depth === 1 || d.team === "") return "default";
            return "pointer";
        })
        .on("click", function(d) {
            if (d.team === "") return;
            if (d.parent === null) return;
            if (d.parent.team === d.team) return;

            populateParent(d);

            refreshBoxContent();

            d.hovering = false;
            unsetParentsPending(d);
            restyleHoverPending();

            refreshBracketTeamsCode();
        })
        .on("mouseover", function(d) {
            if (d.team === "") return;
            if (d.parent === null) return;
            if (d.parent.team === d.team) return;

            d.hovering = true;
            d.parent.pending = true;
            setParentsPending(d.parent, d.parent.team);
            restyleHoverPending();
        })
        .on("mouseout", function(d) {
            if (d.team === "") return;
            if (d.parent === null) return;

            d.hovering = false;
            unsetParentsPending(d);
            restyleHoverPending();
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
        .classed('team-swatch', true)
        .classed('region-1', function(d) { return d.region === 1; })   
        .classed('region-2', function(d) { return d.region === 2; })
        .classed('region-3', function(d) { return d.region === 3; })
        .classed('region-4', function(d) { return d.region === 4; })
        .classed('team-even', function(d, i) { return i % 2 == 0; })
        .classed('pair-even', function(d, i) { return Math.floor(i/2) % 2 == 0; })
        .attr("x", -10)
        .attr("width", 8)
        .attr("height", function(d) { return d.value * yScale.rangeBand(); })
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
