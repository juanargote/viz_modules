$(function(){
    var format = d3.time.format("%Y-%m-%dT%X+00:00");
    console.log(format(new Date()))

    // Wire the date picker
    $( "#datepicker" ).datepicker();
    $("#getTrajectory").click(function(){
        console.log($('form').serialize());
        
        var query_data = {};
        var start_date = format(new Date(2014,9,24));
        var end_date = format(new Date(2014,9,25));
        query_data['ts'] = '[' + start_date + ',' + end_date + ']';
        query_data['route_id'] = '11-111';
        query_data['select'] = ['ts','event_type','stop_postmile','trip_id','delay','vehicle_id'].join();
        // Ajax call that retrieves the agency name
        $.ajax({
            type: "GET",
            dataType: "json",
            data: query_data,
            // url: "https://vtfs.v-a.io/" + userDetails.agency.shortname + "/" + "event",
            url: "https://vtfs.v-a.io/" + 'actransit' + "/" + "event",
            beforeSend: function(request) {
                request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
                request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
            },
            success: function(data){
                console.log(data);
                visual.create(data)
            },
            complete: function(){
                // $(".output-visual").show(1000);
                $("#explanation").show(1000);
            },
            error: function(jqXHR,textStatus,errorThrown){
                console.log(jqXHR)
                console.log(errorThrown);
            }

        });
    })
});

var visual = (function(){
    var visual = {}
    var local = {}

    var margin = {top: 20, right: 50, bottom: 30, left: 50},
        width = 920 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    var parseDate = d3.time.format("%Y-%m-%d %X+00:00").parse;

    var x = d3.time.scale()
        .range([0, width]);

    var y = d3.scale.linear()
        .range([height, 0]);

    var color = d3.scale.category10();

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    var line = d3.svg.line()
        .interpolate("basis")
        .x(function(d) { return x(d.time); })
        .y(function(d) { return y(d.stop_postmile); });

    visual.create = function(data){

        var svg = d3.select(".output-visual").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        data = data.event
        data.forEach(function(d) {
          d.time = parseDate(d.ts);
        });

        var nest = d3.nest().key(function(d){return d.trip_id + '-' + d.vehicle_id}).entries(data)

        x.domain( d3.extent(data, function(d) { return d.time; }) );

        y.domain( d3.extent(data, function(d) { return d.stop_postmile }) );

        local.xAxis = svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        local.yAxis = svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Postmile");

        local.canvas = svg.selectAll(".trajectory").data(nest).enter().append("g")
            .attr("class", "trajectory");

        local.canvas.append("path")
            .attr("class", "line")
            .attr("d", function(d) { return line(d.values); });
    }

    visual.remove = function(){
        console.log("removing")
    }

    visual.figure = "test"
    return visual
})();


