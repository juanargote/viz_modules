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

function get_current_service_id(){
    var calendar_service_ids = [];
    var calendar_dates_service_ids = [];
    var calendar_dates_service_ids_ignore = [];
    var service_ids = [];

    $.when(
        $.ajax({
            type: "GET",
            dataType: "json",
            data: get_current_service_id_query_parameters_calendar(),
            url: userDetails.agency.apiurl + "gtfs_calendar",
            beforeSend: function(request) {
                request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
            },
            success: function(data){
                for (key in data['gtfs_calendar']){
                    calendar_service_ids.push(data['gtfs_calendar'][key]['service_id']);
                }
            }
        }),
        $.ajax({
            type: "GET",
            dataType: "json",
            data: get_current_service_id_query_parameters_calendar_dates(),
            url: userDetails.agency.apiurl + "gtfs_calendar_dates",
            beforeSend: function(request) {
                request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
            },
            success: function(data){
                for (key in data['gtfs_calendar_dates']){
                    if (data['gtfs_calendar_dates'][key]['exception_type'] == 1){
                        calendar_dates_service_ids.push(data['gtfs_calendar_dates'][key]['service_id']);
                    } else if (data['gtfs_calendar_dates'][key]['exception_type'] == 2){
                        calendar_dates_service_ids_ignore.push(data['gtfs_calendar_dates'][key]['service_id']);
                    }
                }
            }
        })
        ).then(function(){
            // Add service ids from calendars if necessary
            for (key in calendar_service_ids){
                if (calendar_dates_service_ids_ignore.indexOf(calendar_service_ids[key]) < 0){
                    service_ids.push(calendar_service_ids[key])
                }
            }

            // Add service ids from calendar dates
            for (key in calendar_dates_service_ids){
                service_ids.push(calendar_dates_service_ids[key])
            }
        });
}

function get_current_service_id_query_parameters_calendar(){
    query_data = {};
    var start_moment = moment.tz($("#datepicker").val(),userDetails.agency.timezone);
    var service_date = "'" + start_moment.format("YYYYMMDD") + "'";
    var service_day = start_moment.format("dddd").toLowerCase();
    query_data['start_date'] = '<' + service_date;
    query_data['end_date'] = '>' + service_date;
    query_data[service_day] = "1";
    query_data['select'] = "service_id";
    return query_data 
}

function get_current_service_id_query_parameters_calendar_dates(){
    query_data = {};
    var start_moment = moment.tz($("#datepicker").val(),userDetails.agency.timezone);
    var service_date = start_moment.format("YYYYMMDD");
    query_data['date'] = service_date;
    query_data['distinct'] = 'service_id'
    query_data['select'] = ["service_id","exception_type"].join();
    return query_data 
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
            
                