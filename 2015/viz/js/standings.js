var margin = {
    top: 50,
    right: 150,
    bottom: 50,
    left: 110
};
var width = 950 - margin.left - margin.right;
var height = 850 - margin.top - margin.bottom;

var currentRound = 2;

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

var roundLabels = roundLabelsPlayed.slice(0, currentRound).concat(roundLabelsUnplayed.slice(currentRound));

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

var color = d3.scale.ordinal()
    .range(colorsPlayed.slice(-currentRound).concat(colorsUnplayed.slice(0, -currentRound)))
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

var data;

d3.csv("data/standings.csv", function(error, inputData) {
    data = inputData;

    color.domain(roundLabels);

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
        .attr("dy", "-3em")
        .style("text-anchor", "middle")
        .text("Score")
    ;

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
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
    ;

    var legend = svg.selectAll(".legend")
        .data(color.domain())
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", function(d, i) {
            return "translate(" + (width + 20) + "," + (50 + i * 20) + ")";
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

    legend.append("rect")
        .attr("x", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", color)
    ;

    legend.append("text")
        .attr("x", 25)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(function(d) {
            return d;
        })
    ;
});
