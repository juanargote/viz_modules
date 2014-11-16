var route_data = [];

var temp = {}

function get_map(array, key, value){
    if (key == undefined) {key = "key"}
    if (value == undefined) {value = "value"}
    var associative_array = {}
    array.forEach(function(d){
        associative_array[d[key]] =d[value] 
    })
    return associative_array
}

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
        multiple: false,
        data: function(){return {results:route_data}}
    });
    get_available_routes();
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

    var margin = {top: 30, right: 60, bottom: 30, left: 60},
        width = 940 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

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
        .interpolate("cardinal")
        .x(function(d) { return x(d.shape_dist_traveled); }) // postmile
        .y(function(d) { return y(d.shape_id); }); // 

    var stop_color = d3.scale.category20();

    api.create = function(){

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

        var primary_shapes = get_primary_shape(temp.gtfs_stop_times)
        
        var stop_shape_travel_distance = get_map(d3.nest()
            .key(function(d){return d.stop_id})
            .key(function(d){return d.shape_id})
            .entries(temp.gtfs_stop_times).map(function(stop_obj){
                stop_obj.values = get_map(stop_obj.values.map(function(shape_obj){
                    return {key: shape_obj.key, value:shape_obj.values[0].shape_dist_traveled}
                }))
                return stop_obj
            }),"key","values")

        var trajectories = d3.nest()
            .key(function(d){return d.direction_id})
            .entries(temp.gtfs_stop_times)

        trajectories.forEach(function(direction_obj){
            var tree_branches = []
            var my_direction = direction_obj.key

            direction_obj.primary_shape = primary_shapes[direction_obj.key]
            // first i need to know which shapes exist in this direction
            direction_obj.values = d3.nest()
                .key(function(d){return d.shape_id})
                .entries(direction_obj.values)

            // now i'm going to travel through each shape finding the alignment
            direction_obj.values.forEach(function(shape_obj){
                shape_obj.values = d3.nest()
                    .key(function(d){return d.stop_id})
                    .entries(shape_obj.values).map(function(stop_obj){
                        return stop_obj.values[0]
                    }).sort(function(a,b){
                        return a.shape_dist_traveled-b.shape_dist_traveled
                    })

                
                // now in shape_obj.values i have an array of stops, sorted by travel distance 
                // if the shape is the primary then i will go ahead and mark it as aligned
                if (shape_obj.key == direction_obj.primary_shape){
                    shape_obj.values.forEach(function(stop){
                        stop.aligned_distance_traveled = stop.shape_dist_traveled
                        stop.true_align = true
                        stop.branch_id = 0
                    })
                    direction_obj.aligned_shapes = [shape_obj]
                    shape_obj.aligned = true

                    tree_branches.push({
                        branch_id: 0, 
                        domain: d3.extent(shape_obj.values.map(function(d){return d.shape_dist_traveled})), 
                    })
                }
            })

            var keep_trying_to_align = true
            while (keep_trying_to_align) {
                // i look for posibilities to align, if i succede at least in one i will do the alignment and
                // update keep_trying_to_align to true
                keep_trying_to_align = false
                direction_obj.values = direction_obj.values.filter(function(shape_obj){return !shape_obj.aligned})
                var branch_id = 0

                direction_obj.values.forEach(function(shape_obj){
                    // see if it's posible to make an alignment
                    var can_be_aligned = false
                    
                    shape_obj.values.forEach(function(stop){
                        
                        direction_obj.aligned_shapes.forEach(function(aligned_shape_obj){
                            if (stop_shape_travel_distance[stop.stop_id][aligned_shape_obj.key] != undefined) {
                                var aligned_stop = aligned_shape_obj.values.filter(function(d){return d.stop_id == stop.stop_id})[0]

                                stop.aligned_distance_traveled = aligned_stop.aligned_distance_traveled
                                can_be_aligned = true
                                keep_trying_to_align = true
                                stop.true_align = true
                                stop.branch_id = aligned_stop.branch_id
                            }
                        })

                    })
                    var segment = {first: undefined, last: undefined, stops:[]}
                    if (can_be_aligned) {

                        for (var i = 0; i < shape_obj.values.length; i++) {

                            if (shape_obj.values[i].true_align || i == shape_obj.values.length - 1) {
                                segment.first = segment.last
                                if (shape_obj.values[i].true_align ) { 
                                    segment.last = i
                                } else {
                                    segment.last = undefined
                                    segment.stops.push(i)
                                } 

                                if (segment.first == undefined && segment.last != undefined && segment.stops.length > 0) {
                                    branch_id++
                                    
                                    var anchor = shape_obj.values[segment.last]
                                    var alignment = anchor.aligned_distance_traveled - anchor.shape_dist_traveled
                                    
                                    segment.stops.forEach(function(stop_sequence){
                                        shape_obj.values[stop_sequence].aligned_distance_traveled = shape_obj.values[stop_sequence].shape_dist_traveled + alignment
                                        shape_obj.values[stop_sequence].true_align = false
                                        shape_obj.values[stop_sequence].branch_id = branch_id
                                    })
                                    tree_branches.push({
                                        branch_id: branch_id, 
                                        domain: [
                                                shape_obj.values[segment.stops[0]].aligned_distance_traveled,
                                                shape_obj.values[segment.stops[segment.stops.length-1]+1].aligned_distance_traveled 
                                            ], 
                                    })
                                } else {

                                if (segment.first != undefined && segment.last == undefined && segment.stops.length > 0) {
                                    branch_id++
                                    var anchor = shape_obj.values[segment.first]
                                    var alignment = anchor.aligned_distance_traveled - anchor.shape_dist_traveled

                                    segment.stops.forEach(function(stop_sequence){
                                        shape_obj.values[stop_sequence].aligned_distance_traveled = shape_obj.values[stop_sequence].shape_dist_traveled + alignment
                                        shape_obj.values[stop_sequence].true_align = false
                                        shape_obj.values[stop_sequence].branch_id = branch_id
                                    })
                                    tree_branches.push({
                                        branch_id: branch_id, 
                                        domain: d3.extent([
                                                shape_obj.values[segment.stops[0]-1].aligned_distance_traveled ,
                                                shape_obj.values[segment.stops[segment.stops.length-1]].aligned_distance_traveled 
                                            ]), 
                                    })
                                } else {

                                if (segment.first != undefined && segment.last != undefined && segment.stops.length > 0) {
                                    branch_id++
                                    var anchor = [shape_obj.values[segment.first] , shape_obj.values[segment.last]]
                                   
                                    var align_scale = d3.scale.linear()
                                        .domain(anchor.map(function(d){return d.shape_dist_traveled}))
                                        .range(anchor.map(function(d){return d.aligned_distance_traveled}))

                                    segment.stops.forEach(function(stop_sequence){
                                        shape_obj.values[stop_sequence].aligned_distance_traveled = align_scale(shape_obj.values[stop_sequence].shape_dist_traveled)
                                        shape_obj.values[stop_sequence].true_align = false
                                        shape_obj.values[stop_sequence].branch_id = branch_id
                                    }) 
                                    tree_branches.push({
                                        branch_id: branch_id, 
                                        domain: d3.extent([
                                                shape_obj.values[segment.stops[0]-1].aligned_distance_traveled,
                                                shape_obj.values[segment.stops[segment.stops.length-1]+1].aligned_distance_traveled 
                                            ]), 
                                    })                                   
                                }}}
        
                                segment.stops = []
                            } else {
                                segment.stops.push(i)
                            }
                            shape_obj.values[i]
                        };
                        direction_obj.aligned_shapes.push(shape_obj)
                        shape_obj.aligned = true
                    }  
                })                
            }

            var display_tree = [[tree_branches[0]]]
            var dictionary_branch_to_vertical_display = {0:0}

            tree_branches = tree_branches
                .filter(function(branch){return branch.branch_id != 0})
                .sort(function(a,b){return -(b.domain[1]-b.domain[0]-a.domain[1]+a.domain[0])})
            
            tree_branches.forEach(function(branch,i){
                
                var look_in_branch_group = display_tree.map(function(branch_group,j){
                    var join_branch_to_branch_group = true
                    branch_group.forEach(function(branch_in_the_group){
                    
                        if (branch_in_the_group.domain[0] < branch.domain[1] + 0 && branch_in_the_group.domain[1] > branch.domain[0] - 0) {
                            join_branch_to_branch_group = false
                        }
                    })
                    if (join_branch_to_branch_group) {
                        return j
                    }
                }).filter(function(d){return d != undefined})
                if (look_in_branch_group.length > 0) {
                    display_tree[look_in_branch_group[0]].push(branch)
                    dictionary_branch_to_vertical_display[branch.branch_id] = look_in_branch_group[0]
                } else {
                    dictionary_branch_to_vertical_display[branch.branch_id] = display_tree.length
                    display_tree.push([branch])
                }

            })

            direction_obj.aligned_shapes.forEach(function(shape_obj){
                shape_obj.values.forEach(function(stop){
                    stop.vertical_display = dictionary_branch_to_vertical_display[stop.branch_id]
                })
            })

            direction_obj.values = direction_obj.values.filter(function(shape_obj){return !shape_obj.aligned})
        })
        

        d3.selectAll("#orange svg").remove();

        trajectories.forEach(function(direction_obj){

            var datum = direction_obj

            var aligned_svg = d3.select("#orange").append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .attr("class","img-responsive center-block")
                .attr("viewBox","0 0 "+(width + margin.left + margin.right)+" "+(height + margin.top + margin.bottom))

            aligned_svg.append("rect")
                .attr("width", width + margin.left/2 + margin.right/2)
                .attr("height", height + margin.top/2 + margin.bottom/2)
                .attr("x", margin.left/2)
                .attr("y", margin.top/2)
                .style("fill","whitesmoke")

            aligned_svg.append("rect")
                .attr("width", margin.left/2)
                .attr("height", height + margin.top/2 + margin.bottom/2)
                .attr("x", 0)
                .attr("y", margin.top/2)
                .style("fill","steelblue")
                
            var aligned_drawingArea = aligned_svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            aligned_svg.append("text")
                .attr("transform","translate("+(margin.left/4)+","+(margin.top + height/2)+")rotate(-90)")
                .attr("text-anchor","middle")
                .attr("dy",5)
                .text("Direction "+direction_obj.key)
                .style("fill","white")

            var background_drawingArea = aligned_drawingArea.append("g");
            

            var aligned_y = d3.scale.ordinal()
                .rangePoints([height, 0],1)
                .domain([direction_obj.key]);

            var aligned_x = d3.scale.linear()
                .range([0, width])
                .domain([
                    d3.min(datum.aligned_shapes.map(function(shape_obj){
                        return d3.min(shape_obj.values.map(function(stop){
                            return stop.aligned_distance_traveled
                        }))
                    })),
                    d3.max(datum.aligned_shapes.map(function(shape_obj){
                        return d3.max(shape_obj.values.map(function(stop){
                            return stop.aligned_distance_traveled
                        }))
                    }))
                ]);

            var aligned_line = d3.svg.line()
                .interpolate("linear")
                .x(function(d) { return aligned_x(d.aligned_distance_traveled); }) // postmile
                .y(function(d) { return aligned_y(d.direction_id) + d.vertical_display * 30; }); // 

            var shape_color = d3.scale.category10().domain(datum.aligned_shapes.map(function(d){return d.key}))

            var shapes_g = aligned_drawingArea.selectAll(".shape").data(datum.aligned_shapes).enter()
                .append("g")
                .attr("class","shape")
            
            shapes_g.each(function(shape_obj){
                background_drawingArea.append("path").datum(shape_obj.values)
                    .attr("d", aligned_line)
                    .style("stroke", "steelblue" )
                    .style("fill","none")
                    .style("stroke-width",15)
                    .attr("stroke-linecap","round")
                    .attr("stroke-linejoin","round")
            })

            shapes_g.selectAll(".stops").data(function(d){return d.values}).enter()
                .append("circle").attr("class","stops")
                .attr("r", 4)
                .attr("cx", function(d){return aligned_x(d.aligned_distance_traveled)})
                .attr("cy", function(d){return aligned_y(d.direction_id) + d.vertical_display * 30})
                .style("fill", "white")

        })
    }

    function get_primary_shape(gtfs_stop_shapes){
        // returns an associative array that maps direction_id with the primary shape_id
        // the primary shape_id is the one with the most stops during the day

        var nest = d3.nest()
            .key(function(d){return d.direction_id})
            .key(function(d){return d.shape_id})
            //.key(function(d){return d.stop_id})
            .entries(gtfs_stop_shapes)

        
        var array = nest.map(function(direction_obj){
                direction_obj.values = direction_obj.values.sort(function(shape_obj_a, shape_obj_b){
                    return shape_obj_b.values.length-shape_obj_a.values.length
                })[0].key
                return direction_obj
            })

        return get_map(array, "key", "values")
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


