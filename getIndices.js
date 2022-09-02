// ----------------- VARIABLES -----------------
// var table = ; // Refers to the shapefile with the AOI
// var s2 = ; // The Sentinel 2 ImageCollection
var AOI = null;
var start_date = null;
var end_date = null;
var cloud_percentage = null;

var used_indexes = {
  NDVI: false,
  GNDVI: false,
  NDMI: false,
  NBRI: false,
  NDWI: false,
  NDSI: false,
  NDGI: false,
};

// Temporary shapefile for testing purposes
AOI = table.filter(
  ee.Filter.or(
    ee.Filter.eq("NAMEUNIT", "Benamocarra"),
    ee.Filter.eq("NAMEUNIT", "Vélez-Málaga")
  )
);

// ----------------- LAYOUT -----------------

// Clear the default layout to define a custom one
ui.root.clear();

// Add the panel where widgets will be contained.
var mainPanel = ui.Panel({
  layout: ui.Panel.Layout.flow("vertical"),
  style: { width: "360px" },
});

var mapPanel = ui.Panel({
  layout: ui.Panel.Layout.flow("horizontal"),
  style: { stretch: "both" },
});

// Add the panel and the map to the layout
ui.root.add(mainPanel);
ui.root.add(mapPanel);

mapPanel.add(ui.Map().setCenter(-3.7, 40.4, 6));

// Define inputs widgets that will be inside the panel
var startDateSlider = ui.DateSlider({
  start: ee.Date(s2.first().get("system:time_start")),
  end: ee.Date(Date.now()),
  onChange: function setDates(range) {
    start_date = range.start();
  },
  period: 1,
  style: { width: "320px" },
});

var endDateSlider = ui.DateSlider({
  start: ee.Date(s2.first().get("system:time_start")),
  end: ee.Date(Date.now()),
  onChange: function setDates(range) {
    end_date = range.start();
  },
  period: 1,
  style: { width: "320px" },
});

var slider = ui.Slider({
  min: 0,
  max: 100,
  step: 1,
  onChange: function setCloudPercentage(value) {
    cloud_percentage = value;
  },
  style: { width: "320px" },
});

// Add widgets to the panel
mainPanel.add(ui.Label("Filtro fecha de inicio:"));
mainPanel.add(startDateSlider);
mainPanel.add(ui.Label("Filtro fecha final:"));
mainPanel.add(endDateSlider);
mainPanel.add(ui.Label("Filtro porcentaje de nubes:"));
mainPanel.add(slider);

mainPanel.add(ui.Label("Índices sintéticos, gráfica interactiva"));

function updateUsedIndexes(checked, checkbox) {
  used_indexes[checkbox.getLabel()] = checked;
}

for (var index in used_indexes) {
  mainPanel.add(
    ui.Checkbox({
      label: index,
      value: used_indexes[index],
      onChange: updateUsedIndexes,
      style: { width: "320px" },
    })
  );
}

var synthetic_use_case_button = ui.Button({
  label: "Ejecutar",
  onClick: synthetic_use_case,
  style: { width: "320px" },
});

mainPanel.add(synthetic_use_case_button);

// ----------------- FUNCTIONS -----------------

// Function to remove cloudy pixels
function cloud_mask_sentinel(image) {
  var cloud_band = image.select("QA60");
  var cloud_bit = 1 << 10;
  var cirrus_bit = 1 << 11;
  var cloud_mask = cloud_band
    .bitwiseAnd(cloud_bit)
    .eq(0)
    .and(cloud_band.bitwiseAnd(cirrus_bit).eq(0));
  return image.updateMask(cloud_mask);
}

// Function for computing and exporting the indices
// It also displays the TCI for the shapefiles in the map
// and an interactive chart with the timeseries
function synthetic_use_case() {
  mapPanel.clear();
  var map = ui.Map();
  mapPanel.add(map);

  //map.addLayer({eeObject: AOI, name: "Geometría del municipio"});
  map.centerObject(AOI, 13);

  // end_date should not be placed as current date, it is prone to bug
  var s2_images = s2
    .filterDate(start_date, end_date)
    .filterBounds(AOI.geometry())
    .filterMetadata("CLOUDY_PIXEL_PERCENTAGE", "Less_Than", cloud_percentage)
    .map(cloud_mask_sentinel);

  var composite = ee.Image(s2_images.median()).clip(AOI.geometry());

  map.addLayer(
    composite,
    {
      max: 4000,
      min: 0.0,
      gamma: 1.0,
      bands: ["B4", "B3", "B2"],
    },
    "TCI composite Sentinel 2"
  );

  var getIndices = s2_images.map(function (SentinelClip) {
    var indexes_added = [];
    if (used_indexes.NDVI) {
      var ndvi = SentinelClip.normalizedDifference(["B8", "B4"]).rename("NDVI");
      indexes_added.push(ndvi);
    }
    if (used_indexes.GNDVI) {
      var gndvi = SentinelClip.normalizedDifference(["B8", "B3"]).rename("GNDVI");
      indexes_added.push(gndvi);
    }
    if (used_indexes.NDMI) {
      var ndmi = SentinelClip.normalizedDifference(["B8", "B11"]).rename("NDMI");
      indexes_added.push(ndmi);
    }
    if (used_indexes.NBRI) {
      var nbri = SentinelClip.normalizedDifference(["B8", "B12"]).rename("NBRI");
      indexes_added.push(nbri);
    }
    if (used_indexes.NDWI) {
      var ndwi = SentinelClip.normalizedDifference(["B3", "B8"]).rename("NDWI");
      indexes_added.push(ndwi);
    }
    if (used_indexes.NDSI) {
      var ndsi = SentinelClip.normalizedDifference(["B3", "B11"]).rename("NDSI");
      indexes_added.push(ndsi);
    }
    if (used_indexes.NDGI) {
      var ndgi = SentinelClip.normalizedDifference(["B3", "B4"]).rename("NDGI");
      indexes_added.push(ndgi);
    }
    return SentinelClip.addBands(indexes_added);
  });

  var addBands = [];
  for (var index in used_indexes) {
    if (used_indexes[index]) {
      addBands.push(index);
    }
  }
  var indices = getIndices.select(addBands);

  var reduced = indices
    .map(function (img) {
      return img.reduceRegions({
        collection: AOI,
        reducer: ee.Reducer.mean(),
      });
    })
    .flatten();
    
  // The URL for downloading the CSV can be seen in the console
  var csvUrl = reduced.getDownloadURL({
    filename: "indices",
  });
  print(csvUrl);

  var chart = ui.Chart.image.series(indices, AOI);

  chart.style().set({
    position: "bottom-right",
    width: "500px",
    height: "250px",
  });

  map.add(chart);

  var label = null;
  chart.onClick(function (xValue, yValue, seriesName) {
    if (!xValue) {
      if (label !== null) {
        map.remove(label);
      }
      return;
    }
    var equalDate = ee.Filter.equals("system:time_start", xValue);
    var image = ee.Image(getIndices.filter(equalDate).first()).clip(AOI);
    var savedBands = [seriesName];
    var savedName = seriesName;
    var indexChosen = ui.Map.Layer(
      image,
      {
        max: 1.0,
        min: -1.0,
        bands: [seriesName],
      },
      seriesName
    );
    map.layers().reset([indexChosen]);
    if (label !== null) {
      map.remove(label);
    }
    label = ui.Label(new Date(xValue).toUTCString());
    map.add(label);
  });
}
