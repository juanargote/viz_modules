var route_data = [];

$(function(){
    var format = d3.time.format("%Y-%m-%dT%X-07:00");

    // Wire the date picker
    $("#datepicker").datepicker().datepicker("setDate", new Date());

    // Wire the route selector
    $("#routepicker").select2({
        createSearchChoice:function(term, data) { 
            if ($(data).filter(function() { return this.text.localeCompare(term)===0; }).length===0) {
                route_data.push({id:term, text:term})
                return {id:term, text:term};
            } 
        },
        multiple: true,
        data: function(){return {results:route_data}}
    });
    get_available_routes();

    // Wire the trajectory display button
    $("#getTrajectory").click(function(){
        var start_moment = moment.tz($("#datepicker").val(),userDetails.agency.timezone);
        var start = start_moment.format();
        var end = start_moment.add(1,'days').format()
        var query_data = {};
        query_data['ts'] = '[' + start + ',' + end + ']';
        query_data['route_id'] = $('#routepicker').val();
        query_data['select'] = ['ts','event_type','stop_postmile','trip_id','delay','vehicle_id'].join();
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

function get_available_routes() {
    var human_to_route_id = {};
    $.ajax({
        type: "GET",
        dataType: "json",
        data: {'select': 'route_id,route_short_name,route_long_name', 'distinct':'route_id'},
        url: userDetails.agency.apiurl + "gtfs_routes_history",
        beforeSend: function(request) {
            request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
            request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
        },
        success: function(data){
            for (i in data['gtfs_routes_history']){
                //define displayed route name
                if ((data['gtfs_routes_history'][i]['route_short_name'] == undefined) || 
                    (data['gtfs_routes_history'][i]['route_short_name'] == '')) {
                    if ((data['gtfs_routes_history'][i]['route_long_name'] == undefined) || 
                        (data['gtfs_routes_history'][i]['route_long_name'] == '')) {
                        route_display_name = data['gtfs_routes_history'][i]['route_id'];
                    } else {
                        route_display_name = data['gtfs_routes_history'][i]['route_long_name'];
                    }                    
                } else {
                    route_display_name = data['gtfs_routes_history'][i]['route_short_name'];
                }
                // store route information
                if (human_to_route_id[route_display_name] == undefined) { 
                    human_to_route_id[route_display_name] = []; 
                }
                human_to_route_id[route_display_name].push(data['gtfs_routes_history'][i]['route_id']);
            }
            //Populate route id selector
            for (key in human_to_route_id) {
                route_data.push({id: human_to_route_id[key], text: key });
            }
        },
        error: function(jqXHR,textStatus,errorThrown){
            console.log(jqXHR)
            console.log(errorThrown);
        }
    });
}

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

        d3.select(".output-visual svg").remove();

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


