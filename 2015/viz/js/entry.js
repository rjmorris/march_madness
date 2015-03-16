var margin = {top: 10, right: 2, bottom: 2, left: 2};
var width = 1000 - margin.left - margin.right;
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

var xScale = d3.scale.ordinal()
    .rangeBands([width, 0], 0.2, 0)
;

var yScale = d3.scale.ordinal()
    .rangeBands([0, height], 0.1, 0)
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

function createTreeBracket(bracket, nodeId, parent) {
    var node = {};

    node.parent = parent;

    if ('team' in bracket[nodeId]) {
        node.team = bracket[nodeId].team;
    }
    else {
        node.team = "";
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
    d3.selectAll(".team-rect")
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
    var parts = bracketCode.split("#");
    return {
        "teams": parts[0],
        "points": parts[1]
    };    
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
}

function applyBracketCode() {
    var bracketCodes = parseBracketCode(codeInput.property("value"));
    bracketTeamsCode = bracketCodes["teams"];
    bracketPointsCode = bracketCodes["points"];

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

    pointsInput.property("value", bracketPointsCode);
}

function refreshBracketPointsCode() {
    bracketPointsCode = pointsInput.property("value");
    codeInput.property("value", buildBracketCode(bracketTeamsCode, bracketPointsCode));
}


d3.json("data/entry.json", function(error, inputBracket) {
    treeBracket = createTreeBracket(inputBracket, "root", null);
    assignBracketDimensions(treeBracket, 1);
    flattenBracket(treeBracket, flatBracket);

    codeInput.attr("size", teams.length + 8);
    refreshBracketTeamsCode();

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
        .attr("d", function(d) { return diagonal(d); })
    ;

    var teamBoxes = svg.selectAll(".team-box")
        .data(flatBracket)
        .enter()
        .append("g")
        .classed("team-box", true)
        .attr("transform", function(d) {
            return "translate(" +
                xScale(d.depth) +
                "," +
                (yScaleCenter(d.breadth) - (d.value * yScale.rangeBand() / 2)) +
                ")";
        })
    ;

    teamBoxes
        .append("rect")
        .attr("width", xScale.rangeBand())
        .attr("height", function(d) { return d.value * yScale.rangeBand(); })
        .classed("team-rect", true)
        .classed("incomplete", function(d) { return d.team === ""; })
        .classed("highlight", false)
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
        .append("text")
        .classed("team-text", true)
        .attr("x", xScale.rangeBand() / 2)
        .attr("y", function(d) { return d.value * yScale.rangeBand() / 2; })
        .attr("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .text(function(d) { return d.team; })
    ;
});
