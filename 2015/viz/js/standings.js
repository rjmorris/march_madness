var margin = {
    top: 40,
    right: 150,
    bottom: 40,
    left: 110
};
var width = 950 - margin.left - margin.right;
var height = 850 - margin.top - margin.bottom;

var roundLabelsPlayed = [
    'Round of 32',
    'Sweet 16',
    'Elite 8',
    'Final 4',
    'Final',
    'Champion'
];

var roundLabelsUnplayed = [
    'Round of 32 (best case)',
    'Sweet 16 (best case)',
    'Elite 8 (best case)',
    'Final 4 (best case)',
    'Final (best case)',
    'Champion (best case)'
];

var sorter = {
    'Round of 32 (best case)': 'sort_cumul_best32',
    'Sweet 16 (best case)': 'sort_cumul_best16',
    'Elite 8 (best case)': 'sort_cumul_best8',
    'Final 4 (best case)': 'sort_cumul_best4',
    'Final (best case)': 'sort_cumul_best2',
    'Champion (best case)': 'sort_cumul_best1',
    'Round of 32': 'sort_cumul32',
    'Sweet 16': 'sort_cumul16',
    'Elite 8': 'sort_cumul8',
    'Final 4': 'sort_cumul4',
    'Final': 'sort_cumul2',
    'Champion': 'sort_cumul1'
};

var cumul_scorer = {
    'Round of 32 (best case)': 'cumul_best_score32',
    'Sweet 16 (best case)': 'cumul_best_score16',
    'Elite 8 (best case)': 'cumul_best_score8',
    'Final 4 (best case)': 'cumul_best_score4',
    'Final (best case)': 'cumul_best_score2',
    'Champion (best case)': 'cumul_best_score1',
    'Round of 32': 'cumul_score32',
    'Sweet 16': 'cumul_score16',
    'Elite 8': 'cumul_score8',
    'Final 4': 'cumul_score4',
    'Final': 'cumul_score2',
    'Champion': 'cumul_score1'
};

var colorsPlayed = [
    "#d1d8ff",
    "#a7b0e8",
    "#7d88d2",
    "#5360bb",
    "#2938a5",
    "#00108f"
];

var colorsUnplayed = [
    "#949494",
    "#a2a2a2",
    "#b0b0b0",
    "#bebebe",
    "#cccccc",
    "#dbdbdb"
];


var highlightColorsPlayed = [
    "#e0e7ff",  // brighter(0.2)
    "#c0caff",  // brighter(0.4)
    "#9aa8ff",  // brighter(0.6)
    "#6e7ff8",  // brighter(0.8)
    "#3a50eb",  // brighter(1.0)
    "#0020db"   // brighter(1.2)
];

var highlightColorsUnplayed = [
    "#aaaaaa",  // brighter(0.40)
    "#b7b7b7",  // brighter(0.35)
    "#c3c3c3",  // brighter(0.30)
    "#cfcfcf",  // brighter(0.25)
    "#dbdbdb",  // brighter(0.20)
    "#e7e7e7"   // brighter(0.15)
];

var svg = d3.select("#standings")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
;

var x = d3.scale.linear()
    .rangeRound([0, width])
;

var y = d3.scale.ordinal()
    .rangeRoundBands([height, 0], .4)
;

var xAxisTop = d3.svg.axis()
    .scale(x)
    .orient("top")
;
var xAxisBottom = d3.svg.axis()
    .scale(x)
    .orient("bottom")
;

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left")
;

var barTip = d3.tip()
    .attr("class", "d3-tip bar-tip")
    .direction("n")
    .offset([-5, 0])  // to make room for the arrow
    .html(function(d) {
        return d.round + ": " + (d.x1 - d.x0) + "<br>" + "Cumulative: " + d.x1 ;
    });

svg.call(barTip);


var data;

var q = queue()
    .defer(d3.csv, "data/standings.csv")
    .defer(d3.csv, "data/bracket_code_key.csv")
;

q.await(function(error, standingsData, keyData) {
    // Determine the current round from the keyData. It is the maximum value in
    // the bracket code, that is, the maximum number of wins by any team in the
    // tournament so far.
    var currentRound = d3.max(keyData[0]['code'].split(''), function(d) { return +d; });

    // Use the currentRound to construct various round-specific attributes.
    // These will be a mix of the values for the rounds that have been played
    // and the rounds that haven't yet been played.
    var roundLabels = roundLabelsPlayed.slice(0, currentRound).concat(roundLabelsUnplayed.slice(currentRound));
    var roundColors = colorsPlayed.slice(-currentRound).concat(colorsUnplayed.slice(0, -currentRound));
    var roundHighlightColors = highlightColorsPlayed.slice(-currentRound).concat(highlightColorsUnplayed.slice(0, -currentRound));

    var color = d3.scale.ordinal()
        .domain(roundLabels)
        .range(roundColors)
    ;

    var highlightColor = d3.scale.ordinal()
        .domain(roundLabels)
        .range(roundHighlightColors)
    ;

    data = standingsData;

    data.forEach(function(d) {
        d3.values(sorter).forEach(function(v) {
            d[v] = +d[v];
        });
        d3.keys(cumul_scorer).forEach(function(v) {
            d[v] = +d[cumul_scorer[v]];
        });

        d.flag_unofficial = d.flag_unofficial == "1";

        var x0 = 0;
        d.scores = color.domain().map(function(round) {
            return {
                round: round,
                x0: x0,
                x1: x0 += d[round] - x0
            };
        });
    });

    data.sort(function(a, b) {
        return d3.descending(a[sorter[roundLabels[currentRound-1]]], b[sorter[roundLabels[currentRound-1]]]);
    });

    x.domain([0, 219]).nice();
    y.domain(data.map(function(d) { return d.name; }));

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxisBottom)
        .append("text")
        .attr("x", width/2)
        .attr("y", 0)
        .attr("dy", "3em")
        .style("text-anchor", "middle")
        .text("Score")
    ;

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0,0)")
        .call(xAxisTop)
        .append("text")
        .attr("x", width/2)
        .attr("y", 0)
        .attr("dy", "-2.25em")
        .style("text-anchor", "middle")
        .text("Score")
    ;

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
    ;

    svg.selectAll(".y.axis .tick text")
        .classed("unofficial", function(d) {
            var player = data.filter(function(p) {
                return p.name === d;
            });
            return player[0].flag_unofficial;
        })
    ;

    var player = svg.selectAll(".player")
        .data(data)
        .enter().append("g")
        .attr("class", "bar-group")
        .attr("transform", function(d) {
            return "translate(0," + y(d.name) + ")";
        })
    ;

    player.selectAll("rect")
        .data(function(d) { return d.scores; })
        .enter().append("rect")
        .attr("x", function(d) {
            return x(d.x0) + 1;
        })
        .attr("y", 0)
        .attr("width", function(d) {
            return d3.max([0, x(d.x1) - x(d.x0) - 1]);
        })
        .attr("height", y.rangeBand())
        .style("fill", function(d) {
            return color(d.round);
        })
        .on("mouseover.1", function(d) {
            d3.select(this)
                .style("fill", function(d) {
                    return highlightColor(d.round);
                })
        })
        .on("mouseover.2", function(d) {
            barTip.show(d);
        })
        .on("mouseout.1", function(d) {
            d3.select(this)
                .style("fill", function(d) {
                    return color(d.round);
                })
        })
        .on("mouseout.2", function(d) {
            barTip.hide(d);
        })
    ;

    var legendGroup = svg.append("g")
        .attr("class", "legend-group")
        .attr("transform", function(d, i) {
            return "translate(" + (width + 20) + ",50)";
        })
    ;

    legendGroup.append('text')
        .attr("id", "legend-title")
        .attr("x", 0)
        .attr("y", -10)
        .text("Sort by:")
    ;

    var legendItems = legendGroup.selectAll(".legend-item")
        .data(color.domain())
        .enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", function(d, i) {
            return "translate(0," + (i * 20) + ")";
        })
        .on("click", function(d) {
            var yNew = y.domain(
                data.sort(function(a, b) {
                    return d3.descending(a[sorter[d]], b[sorter[d]]);
                }).map(function(d) { return d.name; })
            ).copy();

            svg.selectAll(".bar-group")
                .sort(function(a, b) {
                    return d3.descending(yNew(a[sorter[d]]), yNew(b[sorter[d]]));
                })
                .attr("transform", function(d) {
                    return "translate(0," + yNew(d.name) + ")";    
                })
            ;

            d3.select(".y.axis")
                .call(yAxis)
            ;
        })
    ;

    legendItems.append("rect")
        .attr("x", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", color)
    ;

    legendItems.append("text")
        .attr("x", 25)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(function(d) {
            return d;
        })
    ;
});
