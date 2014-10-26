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
            },
            complete: function(){
                $(".table").show(1000);
                $("#explanation").show(1000);
            },
            error: function(jqXHR,textStatus,errorThrown){
                console.log(jqXHR)
                console.log(errorThrown);
            }

        });
    })
});