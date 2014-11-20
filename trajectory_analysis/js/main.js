var route_data = [];

var temp = {}

var lateness_lim = 5, earliness_lim = -1;
var on_time_colors = ["#98df8a","#1f77b4","#d62728"];

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
    var direction_data = {}
    var shape_data = {}
    var dictionary_trip_to_direction = {}
    var dictionary_trip_to_shape = {}
    var data = {}

    api.direction = function(direction_id){
        return direction_data[direction_id]
    }

    api.shape = function(shape_id){
        if (shape_id == undefined) {
            return shape_data
        }
        return shape_data[shape_id]
    }

    api.trip = function(trip_id){
        return shape_data[dictionary_trip_to_shape[trip_id]]
    }

    api.trip_direction = function(trip_id){
        var direction_id = dictionary_trip_to_direction[trip_id]
        if (direction_id != undefined ) {return direction_id
        } else {
            return 3
        }
    }

    api.trip_shape = function(trip_id){
        var shape_id = dictionary_trip_to_shape[trip_id]
        if (shape_id != undefined ) {return shape_id
        } else {
            return 3
        }
    }

    api.trajectory = function(direction_id){
        return data.trajectories[direction_id]
    }

    api.primary_shape = function(direction_id){
        return data.primary_shapes[direction_id];
    }

    api.create = function(){

        temp.gtfs_trips.forEach(function(d){
            dictionary_trip_to_direction[d.trip_id] = d.direction_id
            dictionary_trip_to_shape[d.trip_id] = d.shape_id
        })

        temp.gtfs_stop_times.forEach(function(d){
            d.shape_id = dictionary_trip_to_shape[d.trip_id]
            d.direction_id = dictionary_trip_to_direction[d.trip_id]
        })

        data.primary_shapes = get_primary_shape(temp.gtfs_stop_times)
        
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

            direction_obj.primary_shape = data.primary_shapes[direction_obj.key]
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

                    shape_data[shape_obj.key] = d3.scale.linear()
                        .domain(shape_obj.values.map(function(d){return d.shape_dist_traveled}))
                        .range(shape_obj.values.map(function(d){return d.aligned_distance_traveled}))

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
                            
                        };
                        direction_obj.aligned_shapes.push(shape_obj)
                        
                        shape_data[shape_obj.key] = d3.scale.linear()
                            .domain(shape_obj.values.map(function(d){return d.shape_dist_traveled}))
                            .range(shape_obj.values.map(function(d){return d.aligned_distance_traveled}))

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

            var direction_id = direction_obj.key 
            
            direction_obj.aligned_shapes.forEach(function(shape_obj){
                shape_obj.values.forEach(function(stop){
                    stop.vertical_display = dictionary_branch_to_vertical_display[stop.branch_id]
                })
            })

            direction_data[direction_id] = {
                y: d3.scale.ordinal()
                    .domain(d3.set(d3.values(dictionary_branch_to_vertical_display)).values()),
                x: d3.scale.linear()
                    .domain([
                        d3.min(direction_obj.aligned_shapes.map(function(shape_obj){
                            return d3.min(shape_obj.values.map(function(stop){
                                return stop.aligned_distance_traveled
                            }))
                        })),
                        d3.max(direction_obj.aligned_shapes.map(function(shape_obj){
                            return d3.max(shape_obj.values.map(function(stop){
                                return stop.aligned_distance_traveled
                            }))
                        }))
                    ]),
            }
            direction_obj.values = direction_obj.values.filter(function(shape_obj){return !shape_obj.aligned})
        })
        data.trajectories = get_map(trajectories,"key","aligned_shapes")
    }

    function get_primary_shape(gtfs_stop_shapes){
        // returns an associative array that maps direction_id with the primary shape_id
        // the primary shape_id is the one with the most stops during the day

        var nest = d3.nest()
            .key(function(d){return d.direction_id})
            .key(function(d){return d.shape_id})
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


var loading = (function(){
    var api = {}
    api.display = function(){
        $(".progress-indicators").show(200)

    }
    api.hide = function(){
        $(".progress-indicators").hide(1000)
    }
    return api
})();

var visual = (function(){
    var api = {}

    var margin = {top: 30, right: 30, bottom: 30, left: 260},
        width = 940 - margin.left - margin.right,
        height = 270 - margin.top - margin.bottom;

    var color = d3.scale.category10();

    api.create = function(){

        var data = temp.event

        d3.selectAll("#red div").remove();

        data.forEach(function(d) {
          d.time = moment(d.ts, "YYYY-MM-DD HH:mm:ss+Z")._d
        });
        
        var nest = d3.nest()
            .key(function(d){return layout.trip_direction(d.trip_id)})
            .key(function(d){return d.vehicle_id})
            .key(function(d){return d.trip_id})
            .entries(data)

        var on_time_dict = {}
        for (direction_id in ['0','1']) {
            var delay_array = data.filter(function(d){return layout.trip_direction(d.trip_id) == direction_id}).map(function(d){return d.delay}).sort(function(a,b){return a-b});
            var early_num = d3.bisect(delay_array,earliness_lim*60000);
            var on_time_num = d3.bisect(delay_array,lateness_lim*60000) - d3.bisect(delay_array,earliness_lim*60000);
            var late_num = delay_array.length - d3.bisect(delay_array,lateness_lim*60000);
            var on_time_array = [early_num,on_time_num,late_num];
            on_time_dict[direction_id] = on_time_array;
        }
        console.log(on_time_dict)
        

        nest.sort(function(a,b){return a.key - b.key});

        nest.forEach(function(direction_obj){
            
            var time_domain = d3.extent(data, function(d) { return d.time; })
            
            var x = d3.time.scale()
                .range([0, width])
                .domain( time_domain );

            var y = d3.scale.linear()
                .range([height, 0])
                .domain( layout.direction(direction_obj.key).x.domain() );

            var xAxis = d3.svg.axis().ticks(8)
                .scale(x)
                .orient("bottom");

            var yAxis = d3.svg.axis().ticks(5)
                .tickFormat(function(d){return d > 999 ? (d/1000).toFixed(1).replace(/\.0$/, '') : d})
                .scale(y)
                .orient("left");

            var line = d3.svg.line()
                .interpolate("basis")
                .x(function(d) { return x(d.time); })
                .y(function(d) { 
                    try {
                        return y(layout.trip(d.trip_id)(d.stop_postmile))    
                    } catch(err){
                        return height
                    }    
                });

            var div_header = d3.select("#red").append("div").attr("class","bs-example")

            div_header.append("h3").text("Direction "+direction_obj.key).attr("class","text-primary").style("font-weight","700")
            var div_body = d3.select("#red").append("div").attr("class","highlight")
            
            var svg = div_body.append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .attr("class","img-responsive custom center-block")
                .attr("viewBox","0 0 "+(width + margin.left + margin.right)+" "+(height + margin.top + margin.bottom))

            svg.append("defs").append("clipPath")
                .attr("id","drawing-area-limits")
                .append("rect")
                    .attr("width",width)
                    .attr("height",height)

            var drawingArea = svg.append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            var dir_xAxis = drawingArea.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis);

            var dir_yAxis = drawingArea.append("g")
                .attr("class", "y axis")
                .call(yAxis)
              .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em")
                .style("text-anchor", "end")
                .text("Postmile");

            var dir_vehicles = drawingArea.selectAll(".vehicle").data(direction_obj.values).enter().append("g")
                .attr("clip-path","url(#drawing-area-limits)")
                .attr("class", "vehicle");

            var stop_postmile_focus = drawingArea.append('g').attr('id','focusG-'+direction_obj.key).style('display','none');

            stop_postmile_focus.append('line')
                .attr({
                    'id':'focusLine-' + direction_obj.key,
                    'class':'focusLine',
                })

            dir_vehicles.each(function(d){
                d3.select(this).selectAll(".trip").data(d.values).enter().append("g")
                .attr("class", "trip");
            })

            dir_vehicles.selectAll(".trip").each(function(trip){ 
                if (layout.trip(trip.key) != undefined) {
                    d3.select(this)
                        .append("path")
                        .attr("class", "line")
                        .attr("d", function(d) { return line(d.values); })
                        .style("stroke",function (d) {return color(d.values[0].vehicle_id)});    
                } else {
                    console.log("trip ",trip.key," is not in the schedule and we don't know their shape") 
                }
            })

            var zoomDraw = function(){ 

                var leftBoundary = x.domain()[0].getTime() - time_domain[0].getTime()
                var rightBoundary = x.domain()[1].getTime() - time_domain[1].getTime()
                
                if (leftBoundary < 0) {
                    x.domain([x.domain()[0] - leftBoundary, x.domain()[1] - leftBoundary])
                    zoom.translate([0, zoom.translate()[1]])
                }

                if (rightBoundary > 0) {
                    x.domain([x.domain()[0] - rightBoundary, x.domain()[1] - rightBoundary])
                    zoom.translate([x(time_domain[0]), zoom.translate()[1]])    
                }

                dir_xAxis.call(xAxis);
                dir_vehicles.selectAll(".line").attr("d",function(d) { return line(d.values); })
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

            (function plot_layout(margin){
                var layout_width = 2*margin.left/8
                var layout_margin_left = margin.left/2
                var pie_radius = 2*margin.left/8

                direction_obj.aligned_shapes = layout.trajectory(direction_obj.key)
                var direction_id = direction_obj.key 

                var scale = {}
                
                // Drawing on-time performance donut chart    
                var pie_drawingArea = svg.append("g")
                    .attr("transform","translate("+pie_radius+","+(margin.top+height/2)+")");

                var pie = d3.layout.pie().sort(null);
                var arc = d3.svg.arc()
                    .innerRadius(pie_radius/2)
                    .outerRadius(pie_radius);

                var path = pie_drawingArea.selectAll("path")
                        .data(pie(on_time_dict[direction_id]))
                        .enter().append("path")
                        .attr("fill", function(d, i) { return on_time_colors[i]; })
                        .attr("d", arc);
                
                var layout_drawingArea = svg.append("g")
                    .attr("transform", "translate(" + (layout_margin_left) + "," + margin.top+ ")");

                var background_drawingArea = layout_drawingArea.append("g");
                

                scale.x = layout.direction(direction_id).y.copy().rangePoints([layout_width,0],1)

                scale.y = layout.direction(direction_id).x.copy().range([height,0])

                var aligned_line = d3.svg.line()
                    .interpolate("linear")
                    .y(function(d) { return scale.y(d.aligned_distance_traveled); }) // postmile
                    .x(function(d) { return scale.x(d.vertical_display); }); // 

                var shape_color = d3.scale.category10().domain(direction_obj.aligned_shapes.map(function(d){return d.key}))

                var shapes_g = layout_drawingArea.selectAll(".shape").data(direction_obj.aligned_shapes).enter()
                    .append("g")
                    .attr("class","shape")
                
                shapes_g.each(function(shape_obj){
                    background_drawingArea.append("path").datum(shape_obj.values)
                        .attr("d", aligned_line)
                        .style("stroke", "steelblue" )
                        .style("fill","none")
                        .style("stroke-width",8)
                        .attr("stroke-linecap","round")
                        .attr("stroke-linejoin","round")
                })

                shapes_g.selectAll(".stops").data(function(d){return d.values}).enter()
                    .append("circle").attr("class","stops")
                    .attr("r", 1.5)
                    .attr("cx", function(d){return scale.x(d.vertical_display)})
                    .attr("cy", function(d){return scale.y(d.aligned_distance_traveled)})
                    .style("fill", "white")
                    .style("cursor",function(d){return (d.shape_id == layout.primary_shape(d.direction_id)) ? "pointer" : "auto"})
                    .style("pointer-events",function(d){return (d.shape_id == layout.primary_shape(d.direction_id)) ? "auto" : "none"})
                    .on('mouseout', function(d){
                        var direction_id = d.direction_id;
                        if (d.shape_id == layout.primary_shape(direction_id)) {
                            d3.select('#focusG-' + direction_id).style('display','none');
                        }
                    })
                    .on('mouseover', function(d){
                        var direction_id = d.direction_id;
                        if (d.shape_id == layout.primary_shape(direction_id)) {
                            d3.select('#focusG-' + direction_id).style('display',null);
                            d3.select('#focusG-' + direction_id).select('.focusLine')
                                .attr('x1', 0).attr('y1', y(d.shape_dist_traveled))
                                .attr('x2', width).attr('y2', y(d.shape_dist_traveled));
                        }
                    })

            })(margin);
            
        })
    }

    api.remove = function(){
        console.log("removing")
    }

    return api
})();


