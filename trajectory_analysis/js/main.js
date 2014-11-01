$(function(){
    var format = d3.time.format("%Y-%m-%dT%X-07:00");

    // Wire the date picker
    $("#datepicker").datepicker().datepicker("setDate", new Date());

    $("#getTrajectory").click(function(){
        console.log(userDetails.agency.timezone)
        var start_moment = moment.tz($("#datepicker").val(),userDetails.agency.timezone);
        var start = start_moment.format();
        var end = start_moment.add(1,'days').format()
        var query_data = {};
        query_data['ts'] = '[' + start + ',' + end + ']';
        query_data['route_id'] = '24473,25200';
        query_data['select'] = ['ts','event_type','stop_postmile','trip_id','delay','vehicle_id'].join();
        console.log(query_data.ts);
        // Ajax call that retrieves the agency name
        $.ajax({
            type: "GET",
            dataType: "json",
            data: query_data,
            // url: "https://vtfs.v-a.io/" + userDetails.agency.shortname + "/" + "event",
            url: userDetails.agency.apiurl + "event",
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

    var margin = {top: 20, right: 50, bottom: 30, left: 70},
        width = 940 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

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
          d.time = moment(d.ts, "YYYY-MM-DD HH:mm:ss+Z")._d
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


