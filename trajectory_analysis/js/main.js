$(function(){
    // Wire the date picker
    $( "#datepicker" ).datepicker();
    $("#getTrajectory").click(function(){
        // Ajax call that retrieves the agency name
        $.ajax({
            type: "GET",
            dataType: "json",
            data: {'limit':1},
            url: "https://vtfs.v-a.io/" + userDetails.agency.shortname + "/" + "gtfs_agency",
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