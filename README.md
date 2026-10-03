GEO3: 3D Geology viewer

https://filippeof.github.io/geo3/

<a href="https://filippeof.github.io/geo3/">
  <img src="src/img/example.jpg" alt="Example usage" width="600px" />
</a>


## Features:
  - Create elevation profile (Whole World)
  - Geological maps and Feature Info (Austria, Brazil, Switzerland, Czechia, Germany, France and  Italy) 
  - Drill core profiles (DE/BY)
  - Add custom layer: Drag and drop gpx, kml or geojson file
  - 3D Basemap, Terrain, Satellite layers

## Quick start:
 - Navigation:
   - Pan: PC: Arrow keys, Mobile: Drag
   - Zoom: PC: + - keys, Mobile: Pinch in/out
   - Pitch: PC: Shift + Arrow up/down, Mobile: Click and drag compass button up/down
   - Rotate: PC: Shift + Arrow left/right, Mobile: Click and drag compass button left/right
 - Layer visibility
   - Click on layers button ![Profile Activation](src/img/layers.png), click once to make layer transparent, twice to hide layer
 - Elevation Profile: 
   - Toggle Elevation profile ![Profile Activation](src/img/profile_activate.png), click to define points of profile. Double click to end (or ✔️).
   - Hover over map profile to show position on elevation profile
   - If drill core available: Hover over units for more information
 - Custom data: 
   - Drag and drop gpx, kml or geojson file to window to see track/route. If elevetion profile is active, profile is created for the track/route.
 - Geology info
  - With elevation profile deactivated, click on map for info (e.g. Geological Unit, Lithology, Chronostratigraphy). 
 - Set location parameters in url (lat:latitude[-90,90], lng:Longitude[-180,180],z=zoom[4,18], b: bearing[0,360], p: pitch[0,80]). Example:
    - https://filippeof.github.io/geo3?lat=45.8&lng=6.9&z=10.5&b=90&p=75
     

## Data sources:

  -  Drill core data
      - DE/BY: [DGK25: Bayerisches Landesamt für Umwelt](www.lfu.bayern.de) Lizenz: CC BY 4.0
  
  - Geological maps
      - AT: [GK500 GeoSphere Austria](https://www.geosphere.at/de) Lizenz: CC BY 4.0
      - BR: [Serviço Geológico do Brasil - CPRM](https://www.sgb.gov.br/)
      - CH: [© Data: swisstopo](https://www.swisstopo.admin.ch/en)
      - CZ: [© ČGS](https://cgs.gov.cz/)
      - DE: [GÜK250,GK1000 (WMS), BGR, Hannover, 2019](https://www.bgr.bund.de/) Lizenz: dl-de/by
        - DE/BY: [DGK25: Bayerisches Landesamt für Umwelt](www.lfu.bayern.de) Lizenz: CC BY 4.0
      - FR: [BRGM](https://www.brgm.fr)
      - IT: [ISPRAmbiente](https://www.isprambiente.gov.it/en/projects/soil-and-territory/geosciences-ir)
  
  - Base maps
    - OSM basemap
      - © OpenStreetMap contributors
    - Satellite Imagery
      - EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025) released under <a rel="license" href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY 4.0</a>.
    - Elevation data, Hillshade
      - [© Mapterhorn](https://mapterhorn.com)
        - Data sources: https://mapterhorn.com/attribution/


- JS libs:
  - [Maplibre](https://github.com/maplibre/maplibre-gl-js/)
  - [Turf](https://github.com/Turfjs/turf)
