$(function(){
    // Wire the trajectory display button
    wire_trajectory_display_button();
});

function wire_trajectory_display_button(){

    $("#getTrajectory").click(function(event){
        // Avoid reloading the data
        event.preventDefault();
        
        get_event_data();

        get_shape_direction_data();

        get_stop_shape_data();
    })
}

function get_shape_direction_data(){
    // Perform the queries       
    $.ajax({
        type:"GET",
        datatype:"json",
        data: get_shape_direction_query_params(),
        url: userDetails.agency.apiurl + "gtfs_trips",
        beforeSend: function(request){
            request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
            request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
        },
        success: function(data){
            console.log(data)
            visual.tripData(data);
        }
    }) 
}

function get_shape_direction_query_params(){
    var query_data = {};
    query_data['route_id'] = $('#routepicker').val();
    query_data['distinct'] = 'trip_id';
    query_data['select'] = ['trip_id','direction_id','block_id','shape_id'].join();
    return query_data
}

function get_event_data_query_params(){
    var format = d3.time.format("%Y-%m-%dT%X-07:00");
    var query_data = {};
    var start_moment = moment.tz($("#datepicker").val(),userDetails.agency.timezone);
    var start = start_moment.format();
    var end = start_moment.add(1,'days').format()
    var query_data = {};
    query_data['ts'] = '[' + start + ',' + end + ']';
    query_data['route_id'] = $('#routepicker').val();
    query_data['select'] = ['ts','event_type','stop_postmile','trip_id','delay','vehicle_id'].join();
    return query_data
}

function get_event_data(){
    $.ajax({
        type: "GET",
        dataType: "json",
        data: get_event_data_query_params(),
        url: userDetails.agency.apiurl + "event",
        beforeSend: function(request) {
            request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
            request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
        },
        success: function(data){
            visual.create(data)
            layout.data(data.event)
        }
    });
}

//NOTE: This assumes that a shape id has a single set of stops associated with it
function get_stop_shape_data_query_params(){
    var query_data = {};
    query_data['jointo:gtfs_trips.trip_id'] = 'trip_id';
    query_data['gtfs_trips.route_id'] = $('#routepicker').val();
    query_data['sort'] = 'gtfs_trips.shape_id,ASC:gtfs_stop_times.stop_sequence',
    query_data['distinct'] = ['gtfs_trips.shape_id','gtfs_stop_times.stop_sequence','gtfs_stop_times.stop_id'].join();
    query_data['select'] = ['trip_id','stop_id','stop_sequence','shape_dist_traveled','gtfs_trips.shape_id','gtfs_trips.direction_id'].join();
    return query_data   
}

function get_stop_shape_data(){
    $.ajax({
        type: "GET",
        dataType: "json",
        data: get_stop_shape_data_query_params(),
        url: userDetails.agency.apiurl + "gtfs_stop_times",
        beforeSend: function(request) {
            request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
            request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
        },
        success: function(data){
            console.log('stop shape data')
            console.log(data)
        },
    });
}
            
                