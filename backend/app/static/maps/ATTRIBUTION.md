# Map Data Attribution

- poland-voivodeships.geojson: normalized from ppatrzyk/polska-geojson wojewodztwa-min.geojson; source data notes name Główny Urząd Geodezji i Kartografii and the repository is MIT licensed.
- poland-neighbours.geojson: cropped from Natural Earth country boundaries via datasets/geo-countries. Natural Earth data is in the public domain.
- world-continents.geojson: prepared from Natural Earth 1:110m Admin 0 Countries. Natural Earth data is public domain.
- ancient-civilizations-basemap.geojson: northeast Africa, Europe, and Asia geometry derived from world-continents.geojson; western river lines retained from Natural Earth 1:50m physical vectors. Natural Earth data is public domain.
- ancient-civilizations-regions.geojson: original educational approximations, not historical political boundaries. Placement context: [UNESCO Mohenjo-daro](https://whc.unesco.org/en/list/138/), [UNESCO Yin Xu](https://whc.unesco.org/en/list/1114/), and the [Metropolitan Museum of Art's overview of Neolithic China](https://www.metmuseum.org/it/essays/neolithic-period-in-china).
- world-oceans.geojson: five ocean regions derived from Flanders Marine Institute (2018), IHO Sea Areas v3, CC BY 4.0; GeoJSON source: alvinometric. The supplied dataset groups source sea regions into five oceans and includes Polish names and stable identifiers. world-continents.geojson is used as its background layer.
- italian-unification-islands.geojson: Corsica, Sardinia, and Sicily extracted without geometry changes from the Natural Earth 1:110m geometry in world-continents.geojson. Natural Earth data is public domain.
- german-unification-cities.geojson: approximate WGS84 city-center coordinates for Berlin, Dresden, Stuttgart, and Munich. The geographic background is world-continents.geojson; this layer contains no historical boundaries.
- us-contiguous-states.geojson: contiguous U.S. state boundaries extracted from [leaflet.us-states](https://github.com/EricDalnas/leaflet.us-states/blob/main/src/us-states.geojson), derived from U.S. Census Bureau TIGER/Line public-domain data. Geometry is unchanged.
- us-civil-war-battles.geojson: approximate WGS84 locations of selected historical battle sites. The background uses the present-day U.S. state boundaries above.
- colonialism-suez.geojson and colonialism-east-asia.geojson: country polygons selected from Natural Earth 1:110m Admin 0 Countries (public domain). Present-day outlines are used for locating countries.
