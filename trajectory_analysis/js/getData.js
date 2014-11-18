$(function(){
    // Wire the trajectory display button
    $("#getTrajectory").click(function(event){
        event.preventDefault();
        loading.display()
        get_current_service_id();
    })
});

function load_data(url, query, cb) {
    
    loading.display()

    $.ajax({
        type: "GET",
        dataType: "json",
        data: query,
        url: url,
        beforeSend: function(request) {
            request.setRequestHeader('Access-Control-Allow-Headers', 'apikey, Access-Control-Allow-Origin');
            request.setRequestHeader('apikey', userDetails.user.apikeys[0]);
        },
        success: function(data){
            cb(null, data)
        },
        error: function(jqXHR,textStatus,errorThrown){
            cb(null, [])
            console.log(jqXHR)
            console.log(errorThrown);
        }
    });
}

function got_all_data(error, result){
    
    var temp_obj = {}
    result.forEach(function(result_obj){
        d3.keys(result_obj).forEach(function(key){
            if (key == "gtfs_stop_times")
            result_obj[key].forEach(function(d){
                d.shape_dist_traveled = d.gtfs_stop_times__shape_dist_traveled
                d.trip_id = d.gtfs_stop_times__trip_id
                d.stop_id = d.gtfs_stop_times__stop_id
                d.stop_sequence = d.gtfs_stop_times__stop_sequence
            })
            temp_obj[key] = result_obj[key]
        })
    })
    temp = temp_obj
    layout.create()
    visual.create()
    return loading.hide()
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
            // Store the valid service ids
            temp['service_ids'] = service_ids;
            // Query the trajectory data
            get_trajectory_data();
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

function get_trajectory_data(){
    // Get query params for the second batch of queries, after obtaining service ids
    var start_moment = moment.tz($("#datepicker").val(),userDetails.agency.timezone);
    var start = start_moment.format();
    var end = start_moment.add(1,'days').format();
    var route_id = $('#routepicker').val();

    var query = {
        events: {
            'ts': '[' + start + ',' + end + ']',
            'route_id': route_id,
            'select': ['ts','event_type','stop_postmile','trip_id','delay','vehicle_id'].join()
        },
        gtfs_trips: {
            'route_id' : route_id,
            'distinct' : 'trip_id',
            'select' : ['trip_id','direction_id','block_id','shape_id'].join() 
        },
        gtfs_stop_times: {
            'jointo:gtfs_trips.trip_id': 'trip_id',
            'gtfs_trips.route_id': route_id,
            'sort': 'gtfs_trips.shape_id,ASC:gtfs_stop_times.stop_sequence',
            'select': ['trip_id','stop_id','stop_sequence','shape_dist_traveled'].join(),
        }
    }

    if (temp.service_ids != undefined){
        var services = temp['service_ids'].join();
        query.gtfs_stop_times['gtfs_trips.service_id'] = services;
        query.gtfs_trips['service_id'] = services;
    }

    var q = queue(4);
    q.defer(load_data, userDetails.agency.apiurl + "gtfs_stop_times", query.gtfs_stop_times)
    q.defer(load_data, userDetails.agency.apiurl + "event", query.events) 
    q.defer(load_data, userDetails.agency.apiurl + "gtfs_trips", query.gtfs_trips) 
    q.awaitAll(got_all_data);
}

//NOTE: This assumes that a shape id has a single set of stops associated with it
function get_stop_shape_data_query_params(service_ids){
    var query_data = {};
    query_data['jointo:gtfs_trips.trip_id'] = 'trip_id';
    query_data['gtfs_trips.route_id'] = $('#routepicker').val();
    if (service_ids != undefined) {
        query_data['gtfs_trips.service_id'] = service_ids.join();
    }
    query_data['sort'] = 'gtfs_trips.shape_id,ASC:gtfs_stop_times.stop_sequence',
    query_data['distinct'] = ['gtfs_trips.shape_id','gtfs_stop_times.stop_sequence','gtfs_stop_times.stop_id'].join();
    query_data['select'] = ['trip_id','stop_id','stop_sequence','shape_dist_traveled','gtfs_trips.shape_id','gtfs_trips.direction_id'].join();
    return query_data   
}
            
                