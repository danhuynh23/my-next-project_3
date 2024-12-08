import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import styles from '../styles/Map.module.css';  // Import your CSS module



const formatNumberWithCommas = (num) => new Intl.NumberFormat().format(num);

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

// Calculate global min/max for all monthly data
const calculateMonthlyGlobalMinMax = (data) => {
  const allValues = data.features.flatMap((f) =>
    MONTHS.map((month) => f.properties[month]).filter((v) => v !== null && v !== undefined)
  );

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  return { min, max };
};

// Create a quantile scale for non-continuous data
const createDivergingColorScale = (data, property, cutoffType = 'percentile', cutoffValue = 0.3) => {
  // Extract values from the specified property, filtering null/undefined
  const values = data.features
    .map((f) => f.properties[property])
    .filter((v) => v !== null && v !== undefined);

  // Dynamically determine the cutoff
  let minCutoff;
  if (cutoffType === 'percentile') {
    // Calculate the cutoff based on the percentile
    values.sort((a, b) => a - b); // Sort values in ascending order
    const cutoffIndex = Math.floor(values.length * cutoffValue); // e.g., 50th percentile (median)
    minCutoff = values[cutoffIndex];
  } else if (cutoffType === 'mean') {
    // Calculate the mean of the values
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    minCutoff = mean; // Use the mean as the midpoint
  } else if (cutoffType === 'fixed') {
    // Use a fixed cutoff value
    minCutoff = cutoffValue;
  } else {
    throw new Error('Invalid cutoffType. Use "percentile", "mean", or "fixed".');
  }

  // Calculate the extent of the values
  const [minValue, maxValue] = d3.extent(values);

  // Create a diverging color scale
  return d3
    .scaleLinear()
    .domain([minValue, minCutoff, maxValue]) // Low, midpoint, high
    .range([
      '#2c7bb6', // Blue for low values
      '#ffffbf', // Yellow for the midpoint
      '#d7191c', // Red for high values
    ]);
};


// Create a fixed continuous scale for monthly data
const createFixedContinuousColorScale = (min, max) => 
  d3.scaleLinear().domain([min, max]).range(['#fee5d9', '#a50f15']); // Light to dark red

const createQuantileColorScale = createDivergingColorScale;

// Style GeoJSON features (polygons)
const geoJSONStyle = (colorScale, property, feature, selectedMapArea, showRivers) => {
  const value = feature.properties[property];
  const isSelected = feature.properties.RIVERBASIN === selectedMapArea; // Check if the basin is selected
  return {
    fillColor: value === null || value === undefined ? '#d3d3d3' : colorScale(value), // Gray for no data
    weight: isSelected ? 5 : 2, // Increase border width for selected basin
    opacity: 1,
    color: isSelected ?'blue':'white',
    dashArray: '3',
    fillOpacity: value === null || value === undefined ? 0.5 : 0.7, // Transparent gray for no data
    interactive: !showRivers, // Disable interaction when rivers are visible
  };
};



// Rivers style
const riversStyle = {
  color: 'lightblue',
  weight: 4,
  opacity: 1,
  fillOpacity: 0,
};

const RiversPane = ({ riversData, riversStyle, showRivers }) => {
  const map = useMap();

  useEffect(() => {
    if (!showRivers || !riversData) return;

    // Create or ensure the pane exists
    const pane = map.getPane('rivers-pane') || map.createPane('rivers-pane');
    pane.style.zIndex = 650; // Ensure the rivers are on top

    // Create the rivers layer
    const riversLayer = L.geoJSON(riversData, {
      style: () => ({
        ...riversStyle,
        weight: 4, // Default weight for rivers
      }),
      onEachFeature: (feature, layer) => {
        const riverName = feature.properties?.RIVER || 'Unnamed River';

        layer.on({
          mouseover: (e) => {
            const targetLayer = e.target;
            targetLayer.setStyle({
              color: 'cyan', // Highlight color
              weight: 10, // Highlight weight
              opacity: 1, // Ensure visible
            });
            targetLayer.bindPopup(`<strong>River:</strong> ${riverName}`).openPopup();
          },
          mouseout: (e) => {
            const targetLayer = e.target;
            targetLayer.setStyle(riversStyle); // Reset to default style
            targetLayer.closePopup();
          },
        });
      },
    }).addTo(map);

    return () => {
      // Remove the rivers layer and pane on cleanup
      map.removeLayer(riversLayer);
    };
  }, [map, riversData, showRivers, riversStyle]);

  return null; // No direct rendering; managed dynamically
};


const Legend = ({ colorScale, property, isContinuous }) => {
  const map = useMap();

  useEffect(() => {
    if (!colorScale) return;

    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      const [min, mid, max] = colorScale.domain(); // Diverging scale domains (min, midpoint, max)
      if (isContinuous) {
        const [min, max] = colorScale.domain();
        // Continuous scale: gradient bar
        div.innerHTML = `
          <div>
            <div style="background: linear-gradient(to right, #fee5d9, #a50f15 ); width: 100px; height: 10px;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span>${formatNumberWithCommas(min)}</span>
            <span>${formatNumberWithCommas(max)}</span>
          </div>
        `;
      } else {
      // Create a gradient legend for diverging scales
      div.innerHTML = `
        <h4>${property.toUpperCase()}</h4>
        <div style="background: linear-gradient(to right, #2c7bb6, #ffffbf, #d7191c); width: 200px; height: 10px; margin-bottom: 5px;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span>${formatNumberWithCommas(min)}</span>
          <span>${formatNumberWithCommas(mid)}</span>
          <span>${formatNumberWithCommas(max)}</span>
        </div>
      `;
      }
      return div;
    };

    legend.addTo(map);

    return () => legend.remove();
  }, [colorScale, map, property]);

  return null;
};




// Main Map Component
const Map = ({ geojsonData, onMapAreaSelect, selectedMapArea}) => {
  const [selectedProperty, setSelectedProperty] = useState('population');
  const [selectedMonth, setSelectedMonth] = useState('jan');
  const [colorScale, setColorScale] = useState(null);
  const [isContinuous, setIsContinuous] = useState(false);
  const [monthlyGlobalMinMax, setMonthlyGlobalMinMax] = useState(null);
  const [mapKey, setMapKey] = useState(0); // key to force re-mount of the MapContainer
  const [riversData, setRiversData] = useState(null);
  const [showRivers, setShowRivers] = useState(true); // State to toggle rivers layer
  const [isSatellite, setIsSatellite] = useState(false); // State for map style toggle


  const defaultTileLayer = 'https://cartocdn_{s}.global.ssl.fastly.net/base-antique/{z}/{x}/{y}.png';
  const satelliteTileLayer =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  // Attribution for tile layers
  const defaultAttribution = '&copy; OpenStreetMap contributors';
  const satelliteAttribution = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
  useEffect(() => {
    if (geojsonData) {
      const { min, max } = calculateMonthlyGlobalMinMax(geojsonData);
      setMonthlyGlobalMinMax({ min, max });
    }
  }, [geojsonData]);

  useEffect(() => {
    let propertyToView = selectedProperty === 'monthly' ? selectedMonth : selectedProperty;
    if (geojsonData && propertyToView) {
      let scale;
      if (selectedProperty === 'monthly' && monthlyGlobalMinMax) {
        scale = createFixedContinuousColorScale(monthlyGlobalMinMax.min, monthlyGlobalMinMax.max);
        setIsContinuous(true);
      } else {
        scale = createQuantileColorScale(geojsonData, propertyToView);
        setIsContinuous(false);
      }
      setColorScale(() => scale);
    }
  }, [geojsonData, selectedProperty, selectedMonth, monthlyGlobalMinMax]);

  // Force full map reload when property changes
  useEffect(() => {
    setMapKey((prevKey) => prevKey + 1);
  }, [selectedProperty]);

  const onEachFeature = (feature, layer) => {
    const updateStyle = () => {
      const propertyToDisplay = selectedProperty === 'monthly' ? selectedMonth : selectedProperty;
      const style = geoJSONStyle(colorScale, propertyToDisplay, feature);
      layer.setStyle(style);
    };

    const propertyToDisplay = selectedProperty === 'monthly' ? selectedMonth : selectedProperty;
    const propertyValue = feature.properties[propertyToDisplay] || 'No Data';
    const formattedValue =
      propertyValue !== 'No Data' ? formatNumberWithCommas(propertyValue) : propertyValue;
    const basinName = feature.properties.RIVERBASIN || 'Unknown Basin';

    layer.on({
      mouseover: (e) => {
        onMapAreaSelect(feature.properties.RIVERBASIN);  // Notify parent of selected area
        const layer = e.target;
        layer.setStyle({
          weight: 5,
          color: '#666',
          dashArray: '',
          fillOpacity: 0.9,
        });
        layer.bindPopup(
          `<strong>Basin:</strong> ${basinName}<br/><strong>${propertyToDisplay}:</strong> ${formattedValue}`
        );
        layer.openPopup();
      },
      mouseout: () => {
        updateStyle();
        layer.closePopup();

      // Clear selected area
      onMapAreaSelect(null);

      },
    });

    updateStyle(); // Ensure correct initial style
  };


  useEffect(() => {
    // Load GeoJSON from the public folder
    fetch('/river.json')
      .then((response) => response.json())
      .then((data) => setRiversData(data))
      .catch((error) => console.error('Error loading river GeoJSON:', error));
  }, []);

  return (
    <div className={styles.mapContainer}>
      {/* UI Controls */}
      <div  className={styles.uiControlsContainer}>
      {/* Toggle Button for Rivers */}
      
      <div className={styles.toggleContainer}>
        <button
            onClick={() => setIsSatellite(!isSatellite)}
            className={`${styles.toggleButton} ${isSatellite ? styles.activeButton : ''}`}
          >
            {isSatellite ? 'Switch to Default' : 'Switch to Satellite'}
          </button>
          <button
            className={`${styles.toggleButton} ${showRivers ? styles.activeButton : ''}`}
            onClick={() => setShowRivers(!showRivers)} // Toggle the state
          >
            {showRivers ? 'Hide Rivers' : 'Show Rivers'} {/* Change text based on state */}
          </button>
        </div>

      <div className={styles.uiControls}>
        <label htmlFor="property-select"></label>
        <select
          id="property-select"
          value={selectedProperty}
          onChange={(e) => setSelectedProperty(e.target.value)}
        >
          <option value="population">Population</option>
          <option value="average">Average Scarcity</option>
          <option value="monthly">Monthly Data</option>
        </select>
      </div>

      {selectedProperty === 'monthly' && (
        <div className={styles.uicontrolsbars}>
          <div className="rangeControl">
          <label htmlFor="month-select"></label>
          <input
            id="month-select"
            type="range"
            min="0"
            max="11"
            step="1"
            value={MONTHS.indexOf(selectedMonth)}
            onChange={(e) => setSelectedMonth(MONTHS[e.target.value])}
          />
          <span>{selectedMonth.toUpperCase()}</span>
          </div>
        </div>
      
      )}
      </div>

      {/* Single MapContainer that is reloaded on property changes */}
      <MapContainer key={mapKey} center={[40, 40]} zoom={2} style={{ height: '100vh', width: '100%' }}>
      {/* Toggleable TileLayer */}
      {isSatellite ? (
          <TileLayer url={satelliteTileLayer} attribution={satelliteAttribution} />
        ) : (
          <TileLayer url={defaultTileLayer} attribution={defaultAttribution} />
        )}


        

        {/* Polygon Layer */}
        {colorScale && (
          <GeoJSON
            key={`${selectedProperty}-${mapKey}`} // Ensure unique key for re-renders
            data={geojsonData}
            style={(feature) =>
              geoJSONStyle(
                colorScale,
                selectedProperty === 'monthly' ? selectedMonth : selectedProperty,
                feature,
                selectedMapArea,
                showRivers 
              )
            }
            onEachFeature={onEachFeature}
          />
        )}

        {/* Rivers Layer */}
        <RiversPane riversData={riversData} riversStyle={riversStyle} showRivers={showRivers} />

        {/* Legend */}
        {colorScale && (
          <Legend
            colorScale={colorScale}
            property={selectedProperty === 'monthly' ? selectedMonth : selectedProperty}
            isContinuous={isContinuous}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default Map;
