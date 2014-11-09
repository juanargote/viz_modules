var route_data = [];

var temp = {}

$(function(){
    var format = d3.time.format("%Y-%m-%dT%X-07:00");

    // Wire the date picker
    $("#datepicker").datepicker().datepicker("setDate", new Date());

    // $("#routepicker").chosen()
    // Wire the route selector
    $("#routepicker").select2({
        createSearchChoice:function(term, data) { 
            if ($(data).filter(function() { return this.text.localeCompare(term)===0; }).length===0) {
                route_data.push({id:term, text:term})
                return {id:term, text:term};
            } 
        },
        multiple: false,
        data: function(){return {results:route_data}}
    });
    get_available_routes();

    // Wire the trajectory display button
    $("#getTrajectory").click(function(event){
        event.preventDefault();
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

                temp.event = data.event
                visual.create()
                
                // second data request

                var query_data2 = {};
                query_data2['route_id'] = $('#routepicker').val();
                query_data2['select'] = ['trip_id','direction_id','block_id','shape_id'].join();
                
                $.ajax({
                    type: "GET",
                    dataType: "json",
                    data: query_data2,
                    url: userDetails.agency.apiurl + "gtfs_trips",
                    beforeSend: function(request) {
                        request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
                        request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
                    },
                    success: function(data){
                        temp.gtfs_trips = data.gtfs_trips;
                        visual.show_direction();
                        layout.data(data.event)
                    },
                    complete: function(){
                    },
                    error: function(jqXHR,textStatus,errorThrown){
                        console.log(jqXHR)
                        console.log(errorThrown);
                    }

                });
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

var layout = (function(){
    var api = {}
    var local = {}

    var margin = {top: 10, right: 60, bottom: 30, left: 70},
        width = 940 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    var x = d3.scale.linear()
        .range([0, width]);

    var y = d3.scale.ordinal()
        .rangePoints([height, 0],1);

    var yDirection = d3.scale.ordinal()
        .rangePoints([height, 0],1);

    var color = d3.scale.category10();

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    var line = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return x(d.shape_dist_traveled); }) // postmile
        .y(function(d) { return y(d.shape_id); }); // 

    var stop_color = d3.scale.category20();

    var DATA

    var TRIPS_DATA

    var STOPS_DATA

    api.data = function(data){
        

        if (!arguments.length) {
            return {data: DATA, trips: TRIPS_DATA}
        } else {
            DATA = temp.event
            TRIPS_DATA = d3.nest()
                .key(function(d){return d.trip_id})
                .entries(temp.event)

            var query_data3 = {};
            query_data3['trip_id'] = TRIPS_DATA.map(function(d){return d.key}).join();
            query_data3['select'] = ['trip_id','stop_id','stop_sequence','shape_dist_traveled','arrival_time'].join();
            
            $.ajax({
                type: "GET",
                dataType: "json",
                data: query_data3,
                url: userDetails.agency.apiurl + "gtfs_stop_times",
                beforeSend: function(request) {
                    request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
                    request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
                },
                success: function(data){

                    temp.gtfs_stop_times = data.gtfs_stop_times
                    x.domain(d3.extent(data.gtfs_stop_times.map(function(d){return d.shape_dist_traveled})))

                    STOPS_DATA = d3.nest()
                        .key(function(d){ return d.trip_id})
                        .entries(data.gtfs_stop_times)

                    STOPS_LINE = d3.nest()
                        .key(function(d){ return d.stop_id})
                        .entries(data.gtfs_stop_times)

                    console.log(STOPS_LINE)
                    
                    
                    api.create()
                },
                complete: function(){
                },
                error: function(jqXHR,textStatus,errorThrown){
                    console.log(jqXHR)
                    console.log(errorThrown);
                }
            });       
        }
    }

    api.create = function(){


        console.log("aligning routes", temp)

        var dictionary_trip_to_direction = {}
        var dictionary_trip_to_shape = {}

        temp.gtfs_trips.forEach(function(d){
            dictionary_trip_to_direction[d.trip_id] = d.direction_id
            dictionary_trip_to_shape[d.trip_id] = d.shape_id
        })

        temp.gtfs_stop_times.forEach(function(d){
            d.shape_id = dictionary_trip_to_shape[d.trip_id]
            d.direction_id = dictionary_trip_to_direction[d.trip_id]
        })


        var stop_trajectories = d3.nest()
            .key(function(d){return d.direction_id})
            .key(function(d){return d.shape_id})
            .key(function(d){return d.stop_id})
            .rollup(function(d){return d[0]})
            .entries(temp.gtfs_stop_times)
        

        STOPS_DATA = d3.nest()
            .key(function(d){ return d.trip_id})
            .entries(temp.gtfs_stop_times)

        console.log(stop_trajectories)
        y.domain(d3.nest()
            .key(function(d){return d.shape_id})
            .entries(temp.gtfs_stop_times)
            .map(function(d){return d.key})
            )
        // yAxis.tickValues(y.domain().filter(function(d, i) { return !(i % 5); }))

        d3.select("#orange svg").remove();

        local.svg = d3.select("#orange").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("class","img-responsive center-block")
            .attr("viewBox","0 0 "+(width + margin.left + margin.right)+" "+(height + margin.top + margin.bottom))
        
        local.svg.append("defs").append("clipPath")
            .attr("id","drawing-area-limits")
            .append("rect")
                .attr("width",width)
                .attr("height",height)

        local.drawingArea = local.svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


        local.xAxis = local.drawingArea.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        local.yAxis = local.drawingArea.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Postmile");

        var direction_g = local.drawingArea.selectAll(".direction").data(stop_trajectories).enter()
            .append("g").attr("class","direction")

        var shape_g = direction_g.each(function(datum){
            console.log(datum)
            d3.select(this).selectAll(".shape").data(datum.values).enter()
            .append("g").attr("class","shape").selectAll(".stops").data(function(d){return d.values}).enter()
                .append("circle").attr("class","stops")
                .attr("r",2)
                .attr("cx", function(d){return x(d.values.shape_dist_traveled)})
                .attr("cy", function(d){return y(d.values.shape_id)})

        }).selectAll(".shape")
        
        // super_test = direction_g

        //console.log(shape_g.data())

        // var stops_g = shape_g.selectAll(".stops").data(function(d){return d}).enter()
        //     .append("circle")
        //     .attr("r",2)
        //     .attr("cx", function(d){return x(d.value)})
        //     .attr("cy", function(d){return y(d.key)})




        // local.drawingArea.selectAll(".trips").data(STOPS_DATA).enter()
        //     .append("g").attr("class","trips")
        //         .each(function(d){
        //             d3.select(this).selectAll(".stops").data(d.values).enter()
        //                 .append("circle")
        //                     .attr("r",2)
        //                     .attr("cx", function(dat){return x(dat.shape_dist_traveled)})
        //                     .attr("cy", function(dat){return y(dat.trip_id)})
        //         })

        console.log(local.drawingArea.selectAll(".stops").data())
        var STOPS_LINE = d3.nest()
                        .key(function(d){ return d.stop_id})
                        .entries(local.drawingArea.selectAll(".stops").data().map(function(d){return d.values}))
        
        console.log(STOPS_LINE)
        local.drawingArea.selectAll(".stop").data(STOPS_LINE).enter()
            .append("path").attr("class","stop")
                .attr("d", function(d){return line(d.values)})
                .style("fill","none")
                .style("stroke", function(d) { return stop_color(d.key)})
    }

    return api
})();

var visual = (function(){
    var visual = {}
    var local = {}

    var margin = {top: 10, right: 60, bottom: 30, left: 70},
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

    visual.create = function(){

        var data = temp.event
        d3.select("#red svg").remove();

        var svg = d3.select("#red").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("class","img-responsive center-block")
            .attr("viewBox","0 0 "+(width + margin.left + margin.right)+" "+(height + margin.top + margin.bottom))
        
        svg.append("defs").append("clipPath")
            .attr("id","drawing-area-limits")
            .append("rect")
                .attr("width",width)
                .attr("height",height)

        var drawingArea = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        data.forEach(function(d) {
          d.time = moment(d.ts, "YYYY-MM-DD HH:mm:ss+Z")._d
        });

        var nest = d3.nest()
            .key(function(d){return d.vehicle_id})
            .key(function(d){return d.trip_id})
            .entries(data)

        local.dataTimeDomain = d3.extent(data, function(d) { return d.time; })
        x.domain( local.dataTimeDomain );

        y.domain( d3.extent(data, function(d) { return d.stop_postmile }) );

        local.xAxis = drawingArea.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        local.yAxis = drawingArea.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Postmile");

        local.vehicles = drawingArea.selectAll(".vehicle").data(nest).enter().append("g")
            .attr("clip-path","url(#drawing-area-limits)")
            .attr("class", "vehicle");

        local.vehicles.each(function(d){
            d3.select(this).selectAll(".trip").data(d.values).enter().append("g")
            .attr("class", "trip");
        })

        local.vehicles.selectAll(".trip")
            .append("path")
            .attr("class", "line")
            .attr("d", function(d) { return line(d.values); });

        local.vehicles.each(function(d){
            d3.select(this).selectAll(".line").style("stroke",color(d.key));
        })
    
        var zoomDraw = function(){ 

            var leftBoundary = x.domain()[0].getTime() - local.dataTimeDomain[0].getTime()
            var rightBoundary = x.domain()[1].getTime() - local.dataTimeDomain[1].getTime()
            
            if (leftBoundary < 0) {
                x.domain([x.domain()[0] - leftBoundary, x.domain()[1] - leftBoundary])
                zoom.translate([0, zoom.translate()[1]])
            }

            if (rightBoundary > 0) {
                x.domain([x.domain()[0] - rightBoundary, x.domain()[1] - rightBoundary])
                zoom.translate([x(local.dataTimeDomain[0]), zoom.translate()[1]])    
            }

            local.xAxis.call(xAxis);
            local.vehicles.selectAll(".line").attr("d",function(d) { return line(d.values); })
        }

        var zoom = d3.behavior.zoom()
            .on("zoom",zoomDraw);

        zoom.scaleExtent([1,Infinity]).x(x);

        drawingArea.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', height)
            .style({
                'fill': 'none',
                'stroke': 'none',
                'pointer-events': 'all',
                'cursor':'pointer',
            })
            .call(zoom);
    }

    visual.show_direction = function(tripData){
        var TRIPDATA = {}
        temp.gtfs_trips.forEach(function(d){
            TRIPDATA[d.trip_id] = d
        })
        local.vehicles.selectAll(".line").each(function(d){
            try {
                if (TRIPDATA[d.key].direction_id != 0) {
                    d3.select(this).attr("stroke-dasharray", "5,5")
                }    
            } catch(err) {
                console.log(d)
                console.log(TRIPDATA[d.key])

            }

            
        })
    }

    visual.remove = function(){
        console.log("removing")
    }

    visual.figure = "test"
    return visual
})();


