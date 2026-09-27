const v_ex = 2 // Vertical exageration

// Elevation Profile
// const v_ex = 2.5 // Vertical exageration #TODO scale svgw,h # defined in map_defs.js
const svg_horz_margin = 50;     // horizontal margin
const svg_vert_margin = 25;     // vertical margin
const svg_poly_w = 930;         // svg polygon width
const svg_poly_h = 230;         // svg polygon heigth
const n_x_ticks = 5;            // Number of ticks, tick labels in x axis
const n_y_ticks = 3;            // Number of ticks, tick labels in y axis
const tick_length = 2;          // tick stroke length
const min_profile_depth = 100;  // Minimum extra depth under minimum elevation (m)
const n_elevation_pts = 200;    // Number of coordinates to sample elevation along profile line

const profile_w_px = 20;            // Profile line stroke width in px
const min_segment_distance = 0.01;  // Minimum distance to consider a segment of profile
var clickedCoords = [];             //PLaceholder coordinates of profile
var profile_cumul_distance = 0;     // PLaceholder profile distance from start to end pt (km)
var reset_profile = false;          // If true, clear profile, reset profile_cumul_distance, clickedCoords,profile_coord_list
const profile_tool_active = false;
document.profile_tool_active = profile_tool_active; // Profile is active

const dc_w = 10; // Drill core profile width

const min_zoom_feature_info = 8; // min zoom to get info on click for WMS,WFS
// Geojson objects
// const bbox_by_poly = [8.97, 47.27, 13.84, 50.56]
// const bbox_by_poly = turf.polygon(
//     [
//         [
//         [9, 47.3],
//         [13.8, 47.3],
//         [13.8, 50.5],
//         [9, 50.5],
//         [9, 47.3],
//         ],
//     ],
//     { name: "bbox_by_poly" },
// );
const geojson_profile = {
    'type': 'FeatureCollection',
    'features': [
        // LINE
        {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': [[0, 0]]
            }
        },
        // START POINT
        {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': []
            }
        },
        // END POINT
        {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': []
            }
        }
    ]
};
// Profile

function linspace(a,b,n_steps){
    out_list = [];
    step = (b-a)/(n_steps-1);
    for (let ii = 0; ii < n_steps; ii++) {
        out_list.push(a+ii*step)
    }
    return out_list
}

function get_scale(z,lat){
    // Get scale (km/px) at given latitude and map zoom
    const res = 156.543 * Math.cos(lat*Math.PI/180) / (2 ** z);
    // console.log(z,lat,res)
    return res
}  

function make_coord_list(in_coord_list, n_points){
    // Make linspaced coordinate list
    let out_coord_list = []
    // Simple case: start and end point: linspace between start and end coords
    if(in_coord_list.length == 2) {
        const start_lon = in_coord_list[0][0];
        const start_lat = in_coord_list[0][1];
        const end_lon = in_coord_list[1][0];
        const end_lat = in_coord_list[1][1];
        const lat_ls = linspace(start_lat, end_lat, n_points);
        const lon_ls = linspace(start_lon, end_lon, n_points);
        for (let ii = 0; ii < n_points; ii++) {
            out_coord_list.push([lon_ls[ii],lat_ls[ii]])
        }
    }
    // Otherwise sample along line using turf
    else
    {
        var line = turf.lineString(in_coord_list);
        const distance_step = profile_cumul_distance/n_points;
        for (let distance = 0; distance <= profile_cumul_distance; distance += distance_step) {
            const pt = turf.along(line, distance, { units: "kilometers" });
            out_coord_list.push(pt.geometry.coordinates);
        }
  
    }

    return out_coord_list
}

async function get_elevation_list(map,coord_list) {

    const promises = coord_list.map(async (coord) => {
        // const lng = coord[0];
        // const lat = coord[1];        
        try {
            // Get value
            const px_val = map.queryTerrainElevation(coord)//, {exaggerated: false}); // elevation in m
            // console.log(px_val)
            return px_val? px_val/v_ex : null; //  /v_ex needed when exageration defined in map defs terrain, exagerated=false has no effect..
            
        } catch (err) {
            // console.error(`Error fetching coordinates [${lng}, ${lat}]:`, err);
            return null; // Return null so each coordinate has an elevation point
        }
    });

    // Wait to get all evevation points
    const results = await Promise.all(promises);
    // console.log("Elevation data:", results);
    return results
    // Filter out null?
    // return results.filter(item => item !== null);
}
function show_cursor_profile(lng,lat){
        // const n_pts = clickedCoords.length
        // const start_pt = turf.point(clickedCoords[0]);
        // const end_pt = turf.point(clickedCoords[clickedCoords.length-1]);
        if (clickedCoords.length<2) return;
        const cur_pt = turf.point([lng,lat]);
        var nearest_pt = turf.nearestPointOnLine(turf.lineString(clickedCoords), cur_pt, {units: "kilometers"});
        const hover_distance = nearest_pt.properties.lineDistance; //Distance from start of linestring (or segment+ segmentDistance?) 
        // make sure is within profile 
        const dist_ratio = Math.min(Math.max(hover_distance/profile_cumul_distance,0),1) 
        const line_x = svg_horz_margin + svg_poly_w*dist_ratio;
        if (!line_x ) return;
        let svg_line = document.getElementById("cursor_ele_line");
        svg_line.setAttribute("x1", line_x);
        svg_line.setAttribute("x2", line_x);
}
async function show_elevation_profile(map){
    // get coordinates along profile, 
    // get elevation at coordinates, 
    // get drill cores that intersect profile (+ buffer), 
    // plot elevation profile and drill cores
    // svg coordinates 
    // |0,0 -----> X
    // |        .
    // v Y       100,100
    // 
    
    // sample coordinates along line (linspaced)
    if (clickedCoords.length <2) return;
    const coord_list = make_coord_list(clickedCoords, n_elevation_pts); //[[lon,lat]]
    // Get elevation for coordinate points
    const ele_list = await get_elevation_list(map,coord_list); 
    const max_ele = Math.max(...ele_list);
    let min_ele = Math.min(...ele_list);
    // Add buffer below min elevation (at least the same distance as elevation diference or min_profile_depth, whatever larger)
    // TODO: user chooses? relative to min_ele | max_ele | min dc depth | max dc depth
    const profile_extra_depth = Math.max(...[(max_ele - min_ele), min_profile_depth]); 
    min_ele = min_ele - profile_extra_depth;
    const dh = max_ele - min_ele;
    // TODO calculate svg_poly_h based on given v.ex.?
    // const m2px_v = dh/svg_poly_h;
    // const m2px_h = 1e3*profile_distance/svg_poly_w;
    // console.log(`v ex: ${m2px_h/m2px_v}`)

    var poly_str = `${svg_horz_margin},${svg_poly_h+svg_vert_margin} `;
    for (let i = 0; i < n_elevation_pts; i++) {
        if (ele_list[i]){                   //!= null
            let x = svg_horz_margin + (i * svg_poly_w / (n_elevation_pts-1)); // Scale x to fit within the SVG width
            let y = svg_poly_h+svg_vert_margin - svg_poly_h*((ele_list[i]-min_ele) / dh); // Scale y to fit within the SVG height
            poly_str += `${x},${y} `;                                           // TODO: smooth path?
        }
    }
    poly_str += `${svg_poly_w+svg_horz_margin},${svg_poly_h+svg_vert_margin} `;

    // Make elevation profile, set clip mask
    const ele_profile =  document.getElementById("ele_profile_svg")
    const polygon = ele_profile.getElementById("elevation_profile_poly");
    const clip_poly = ele_profile.getElementById("profile_clip_poly");
    const profile_txt_group =  ele_profile.getElementById("profile_txt_group");
    polygon.setAttribute("points", poly_str);
    clip_poly.setAttribute("points", poly_str);

    // Set elevation, distance text
    //Remove existing ticks,labels
    profile_txt_group.querySelectorAll(".ele_profile_ticks").forEach(element => {
        profile_txt_group.removeChild(element)
    });
    // Ticks, Ticks Labels
    const dist_txt_list = linspace(0, profile_cumul_distance, n_x_ticks);
    const ele_txt_list = linspace(min_ele, max_ele, n_y_ticks);
    //X ticks (Distance)
    for (let ii = 0; ii < dist_txt_list.length; ii++) {
        const dist = dist_txt_list[ii].toFixed(1);
        const x_tick_pos = svg_horz_margin+svg_poly_w*(dist/profile_cumul_distance);
        // const x_tick =document.createElement('text');
        profile_txt_group.innerHTML +=`<text class="ele_profile_ticks" text-anchor="middle" x="${x_tick_pos}" y="${svg_vert_margin+svg_poly_h+20}">${dist}</text>`;
        profile_txt_group.innerHTML +=`<line class="ele_profile_ticks" x1="${x_tick_pos}" y1="${svg_vert_margin+svg_poly_h+2}" x2="${x_tick_pos}" y2="${svg_vert_margin+svg_poly_h+2+tick_length}" stroke="black" />`;

    }
    //Y ticks (elevation)
    for (let ii = 0; ii < ele_txt_list.length; ii++) {
        const ele = ele_txt_list[ii].toFixed(0);
        const y_tick_pos = svg_vert_margin+ svg_poly_h-svg_poly_h*((ele-min_ele)/(max_ele-min_ele));
        profile_txt_group.innerHTML +=`<text class="ele_profile_ticks" text-anchor="end" dominant-baseline="middle" x="${svg_horz_margin-10}" y="${y_tick_pos}">${ele}</text>`;
        profile_txt_group.innerHTML +=`<line class="ele_profile_ticks" x1="${svg_horz_margin-2-tick_length}" y1="${y_tick_pos}" x2="${svg_horz_margin-2}" y2="${y_tick_pos}" stroke="black"/>`;
    }
    
    // DRILL CORE
    // Get drill core points within buffer profile
    // Buffer profile based on zoom: -> how many km is profile width in px
    const start_pt = clickedCoords[0];
    const end_pt = clickedCoords[clickedCoords.length-1];
    let buffer_profile = (profile_w_px/2)*get_scale(map.getZoom(), (start_pt[1]+end_pt[1])/2); //km
    // buffer_profile = 0.5
    const line_buffer = turf.buffer(geojson_profile, buffer_profile, { units: 'kilometers' });

    // Get drill core intersect with buffered profile
    const dc_geojson = await  map.getSource('dc_lyr_src').getData(); 
    const dc_intersect = turf.pointsWithinPolygon(dc_geojson, line_buffer);
    // TODO: highlight selected?
    let dc_group = ele_profile.getElementById("dc-profile-groups")
    let dc_group_txt = "";
    for (let ii = 0; ii < dc_intersect["features"].length; ii++) {
        const obj =  dc_intersect["features"][ii];
        const obj_id = obj["properties"]["oid"];
        const obj_coords = obj["geometry"]["coordinates"];
        const obj_data =  dc_layer_dict[obj_id];

        let top_h = obj_data["dc_h"]; // current upper limit (will be set to previous units' lower limit)
        const obj_dist = turf.distance(start_pt, obj_coords, {units: "kilometers"});
        const dist_ratio = Math.min(Math.max(obj_dist/profile_cumul_distance,0),1)
        let min_x = svg_horz_margin + svg_poly_w*dist_ratio - dc_w/2;
        if (obj_data!=undefined){
            // Create group containing all units of drill core as rect objects
            dc_group_txt += `<g id="${obj_id}"> <title>${obj_id}</title>` 
            const obj_units = obj_data["units"]
            for (let jj = obj_units.length-1; jj >=0; jj--) {
                const unit = obj_units[jj];
                const lower_h = unit[0];
                const unit_info = formations_dict[unit[1]]
                const unit_long_name = unit_info[1]
                const unit_c = unit_info[2];
                const min_y = svg_poly_h + svg_vert_margin - svg_poly_h*((top_h-min_ele) / dh); // Scale y to fit within the SVG height
                const max_y = svg_poly_h + svg_vert_margin - svg_poly_h*((lower_h-min_ele) / dh);
                const rect_h = (max_y-min_y).toFixed(0)
                if (rect_h>0){
                    dc_group_txt += `<rect x="${min_x.toFixed(0)}" y="${min_y.toFixed(0)}" width="${dc_w}" height="${rect_h}" style="fill:${unit_c};"> 
                                            <title>${unit_long_name}</title> </rect>`
                    }
                // console.log(`${ii}:${obj_id}[${jj}] Lower h:${lower_h}, top h:${top_h} min_y: ${min_y} max_y:${max_y}`)
                top_h = lower_h;
                // if further units are below elevation profile  min depth, stop 
                if (top_h<min_ele){
                    break
                }
            };
            dc_group_txt += `</g>` //finish group

        } 
    }
    dc_group.innerHTML =  dc_group_txt;
    // TODO: if overlapping drill cores in profile, get deepest> get first
    // TODO: export profile? make report (units, legend)
    // TODO: make rectangle/cube profile: interpolate units(simplify by serie?), draw tool for 4 profiles (N,S,E,W)> create basic 3d Model (threejs?)
}

async function get_feature_info(lng,lat,lyr_def){
// Get WMS feature info
// lyr_def =  {"id": "layer_id", "url": "wms get feature info url", "fields": [list of fields to show as table]}
    try {
        const lyr_id = lyr_def["id"];
        const fields = lyr_def["fields"];
        const fields_alias = lyr_def["fields_alias"];
        const info_format = lyr_def["info_format"];
        const info_url = lyr_def["url"].replace("{bbox}",`${lat-0.0001},${lng-0.0001},${lat+0.0001},${lng+0.0001}`).replace("{bbox_xy}",`${lng-0.0001},${lat-0.0001},${lng+0.0001},${lat+0.0001}`); //v1.1.1: ;
        // console.log(`Requesting info from ${lyr_id}\n ${info_url}`)
        const response = await fetch(info_url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const response_txt = await response.text();
        // console.log(lyr_id,response_txt)
        
        let feature_props = {};
        let has_match = false
        // geojson
        if (info_format== "geojson"){
            try {
                const json_txt = JSON.parse(response_txt);
                feature_props = json_txt["features"][0]["properties"]
            } catch (error) {
                console.log("text json error",error)
            }
        }
        // ESRI xml
        else if (info_format== "xml"){
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(response_txt, 'text/xml');
                const data_fields = xmlDoc.querySelector('FIELDS');
                for (const attr of data_fields.attributes) {
                    feature_props[attr.name] = attr.value;
                }
            } catch (error) {
                console.log("text xml error",error)
            }
        }
        //GML
        else if (info_format== "gml"){
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(response_txt, 'text/xml');
                // console.log(xmlDoc)
                // const data_fields = xmlDoc.querySelector('{lyr_name}_feature');
                for (const field_name of fields) {
                    feature_props[field_name] =  xmlDoc.querySelector(field_name).innerHTML ?? "";
                }
            } catch (error) {
                console.log("text gml error",error)
            }
        }
        else{
            console.log(`Can not parse format ${info_format}`)
        }
        
        // console.log(feature_props)
        // Filter only needed fields and Make table |field|val|
        let out_html= "<table class='info-tbl' >";
        for (let index = 0; index < fields.length; index++) {
            try {
                const k = fields[index];
                let v = feature_props[k] ?? "";
                if (v.startsWith("http")){
                    v = `<a href="${v}">Link</a>`
                }
                if (v && v!="" && String(v).toLowerCase() != "null"){
                    out_html += `<tr> <td><strong>${fields_alias[index]}</strong></td> <td>${v}</td> </tr>`
                    has_match = true;
                }
            }
            catch (error) {
                console.log("could not parse field")
            }
        }
    
        out_html+= "</table>"
        if (!has_match){
            out_html = ""
        }

        return out_html
    }
    catch (err_gfi) {
        console.error(err_gfi)
    }

}
async function kml_to_geojson(kml_txt){
    // Convert kml linestring to geojson
    const parser = new DOMParser();
    const gpxXml = parser.parseFromString(kml_txt, 'text/xml');
    // Get placemarks (can be pt, line,poly..)
    const kml_placemarks =  gpxXml.querySelectorAll("Placemark");
    // Checks: has placemark, at least one pmk is line
    if (!kml_placemarks | kml_placemarks.length==0) {
        alert("KML has no placemarks!")
        return
    }
    const n_line_strings = gpxXml.querySelectorAll("LineString").length;
    if (n_line_strings.length==0) {
        alert("KML has no Lines (LineString)!")
        return
    }
    // Make geojson: Each linestring: one feature
    const track_geojson = {
        'type': 'FeatureCollection',
        'features': [ ]
    };
    for (let ii = 0; ii < kml_placemarks.length; ii++) {
        const pmk = kml_placemarks[ii];
        const pmk_name = pmk.querySelector("name")?.innerHTML ?? "";
        // pmk_dsc = description
        // Get linestring: if none try next placemark
        const pmk_linestring = pmk.querySelector("LineString");
        if (!pmk_linestring) continue
        // Get coordinates: lon,lat,[ele] lon,lat,[ele..]
        const pmk_coords = pmk_linestring.querySelector("coordinates");
        if (!pmk_coords) continue
        const pmk_pts = pmk_coords.innerHTML.trim().split(/\s+/);
        console.log(pmk_pts)
        let pmk_coord_list = [];
        // Get points coords
        for (let jj = 0; jj < pmk_pts.length; jj++){
            const pt = pmk_pts[jj].split(",");
            pmk_coord_list.push([parseFloat(pt[0].trim()), parseFloat(pt[1].trim())]); //ele:pt[2]
        }
        // add feature
        track_geojson["features"].push( {
            'type': 'Feature',
            "properties":{
                "name": pmk_name
            },
            'geometry': {
                'type': 'LineString',
                'coordinates': pmk_coord_list
            }
        });
    }
    return track_geojson
}

async function gpx_to_geojson(gpx_txt){
    //Convert gpx track/ routes to geojson line
    const parser = new DOMParser();
    const gpxXml = parser.parseFromString(gpx_txt, 'text/xml');
    // make geojson, add points, multiple routes?
    const gpx_routes =  gpxXml.querySelectorAll("rte");
    const gpx_tracks =  gpxXml.querySelectorAll("trk");
    const track_geojson = {
        'type': 'FeatureCollection',
        'features': [ ]
    };
    // Routes
    for (let ii = 0; ii < gpx_routes.length; ii++) {
        const rte = gpx_routes[ii];
        const rte_name = rte.querySelector("name").innerHTML;
        const rte_pts = rte.querySelectorAll("rtept");
        let rte_coords = [];
        // Route points
        for (let jj = 0; jj < rte_pts.length; jj++){
            const pt = rte_pts[jj];
            rte_coords.push([parseFloat(pt.getAttribute("lon")), parseFloat(pt.getAttribute("lat"))]);
        }
        track_geojson["features"].push( {
            'type': 'Feature',
            "properties":{
                "name": rte_name
            },
            'geometry': {
                'type': 'LineString',
                'coordinates': rte_coords
            }
        });
    }
    //Tracks
    for (let ii = 0; ii < gpx_tracks.length; ii++) {
        const trk = gpx_tracks[ii];
        const trk_name = trk.querySelector("name").innerHTML;
        const trk_segments = trk.querySelectorAll("trkseg");
        //Track segments
        for (let jj = 0; jj < trk_segments.length; jj++) {
            const trk_seg = trk_segments[jj];
            const trk_pts = trk_seg.querySelectorAll("trkpt");
            let trk_seg_coords = [];
            // Track points
            for (let kk = 0; kk < trk_pts.length; kk++) {
                const pt = trk_pts[kk];
                trk_seg_coords.push([parseFloat(pt.getAttribute("lon")), parseFloat(pt.getAttribute("lat"))]);
            }
            track_geojson["features"].push({
                'type': 'Feature',
                "properties":{
                    "name": `${trk_name} (${jj+1}/${trk_segments.length})`
                },
                'geometry': {
                    'type': 'LineString',
                    'coordinates': trk_seg_coords
                }
            })
        }
    }

    return track_geojson
}

function drop_file_handler(event,map) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    const file = files[0];
    if (!file) return;
    const file_format = file.name.split(".").pop().toLowerCase();
    console.log(file_format)
    if (!file_format | !["gpx","geojson","kml"].includes(file_format)) 
        {alert(`Format ${file_format} not allowed `)
            return
        }
    const reader = new FileReader();
    reader.onload = async function (e) {
        let geojson_data = {}
        if (file_format == "gpx") {
            const gpx_txt = e.target.result;
            geojson_data = await gpx_to_geojson(gpx_txt);
        }
        else if (file_format == "geojson") {
            geojson_data = e.target.result;
        }
        else if (file_format == "kml") {
            const kml_txt = e.target.result;
            geojson_data = await kml_to_geojson(kml_txt);
        }
        else{
            alert("Unsupported file format. Please drop a GPX,KML or GeoJSON file.");
        }
        // Add geojson to map
        // Add source/ layer
        map.getSource('custom_linestring_src').setData(geojson_data);

        // map.addSource('gpx_profile', {
        //         'type': 'geojson',
        //         'data': geojson_data
        //     });
        // map.addLayer({
        //     'id': 'gpx_profile',
        //     'type': 'line',
        //     'source': 'gpx_profile',
        //     'paint': {
        //         'line-color': '#831111',
        //         'line-opacity': 0.7,
        //         'line-width': 3
        //     }
        // });
        // zoom to track/route
        if(geojson_data["features"].length>0){
            const first_coord = geojson_data["features"][0]['geometry']['coordinates'][0];
            map.flyTo({
                center: [first_coord[0], first_coord[1]], // [lng, lat]
                zoom: 12
            });
        }
        else{
            alert("No features found in the file.");
        }
    }
    reader.readAsText(file);

    }

function download_profile(out_filename='ele_profile.svg'){
    // Download elevation profile as svg
    // Make it svg string
    const prefix_xml = '<?xml version="1.0" encoding="utf-8"?>'

    const profile_svg_str = prefix_xml+document.getElementById("ele_profile_svg").outerHTML;
    // Make blob
    const svgBlob = new Blob([profile_svg_str], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = out_filename; // The default filename
    // Download blob 
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(blobUrl);
}