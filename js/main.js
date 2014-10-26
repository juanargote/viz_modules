$(function(){
    
    $("#getinfo").click(function(){
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
                // Retrieve the data already loaded
                var mData = d3.entries(data['gtfs_agency'][0])
                var table = d3.select(".agency-information").append("table")
                    .attr({"class":"table table-striped table-hover"})
                    .style({"display":"none"})

                var table_header = table.append("thead").append("tr")

                table_header.append("th").text("Attribute")
                table_header.append("th").text("Value")

                var tr = table.append("tbody")
                    .selectAll("tr").data(mData)
                    .enter()
                    .append("tr")
                    .attr({
                        "class":function(d){
                            if (d.value != ""){
                                return "info"
                            } else {
                                return "warning"
                            }
                        }
                    });

                var td = tr.each(function(){
                        var mtr = d3.select(this);

                        mtr.append("td").text(function(d){
                            return d.key;
                        })

                        mtr.append("td").text(function(d){
                            return d.value;
                        })
                    })
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