$(function(){
    // Wire the date picker
    wire_date_picker();

    // Wire the route selector
    wire_route_picker();    
});

/**
* Auxiliary function to set up the date picker
*/
function wire_date_picker(){
    $("#datepicker").datepicker().datepicker("setDate", new Date());
}

/**
* Auxiliary function to set up the date picker
*/
function wire_route_picker(){
    // Select2 functionality
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
    // Populate the select options
    get_available_routes();
}

/**
* Auxiliary data to populate the route picker select options
*/
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