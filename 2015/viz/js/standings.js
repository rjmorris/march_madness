var margin = {
    top: 50,
    right: 150,
    bottom: 50,
    left: 110
};
var width = 950 - margin.left - margin.right;
var height = 850 - margin.top - margin.bottom;

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
    .range(["#00108f", "#949494", "#a2a2a2", "#b0b0b0", "#bebebe", "#cccccc", "#dbdbdb"])
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

    color.domain([
        'Round of 32',
        'Sweet 16 (best case)',
        'Elite 8 (best case)',
        'Final 4 (best case)',
        'Final (best case)',
        'Champion (best case)'
    ]);

    data.forEach(function(d) {
        d['rank_all'] = +d['rank_all'];

        d['Round of 32'] = +d['score32'];
        d['Sweet 16 (best case)'] = +d['cumul_best_score16'];
        d['Elite 8 (best case)'] = +d['cumul_best_score8'];
        d['Final 4 (best case)'] = +d['cumul_best_score4'];
        d['Final (best case)'] = +d['cumul_best_score2'];
        d['Champion (best case)'] = +d['cumul_best_score1'];

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

    data.sort(function(a, b) { return d3.descending(a['rank_all'], b['rank_all']); });

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
                    return d3.ascending(a[d], b[d]);
                }).map(function(d) { return d.name; })
            ).copy();

            svg.selectAll(".bar-group")
                .sort(function(a, b) { return d3.ascending(yNew(a[d]), yNew(b[d])); })
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
