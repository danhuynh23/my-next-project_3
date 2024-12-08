import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import path from 'path';
import fs from 'fs';
import TreeMap from '../components/TreeMap';
import BarChart from '../components/BarChart';
import Joyride from 'react-joyride'; // Import react-joyride

// Dynamically import the Map component to prevent SSR issues with Leaflet
const Map = dynamic(() => import('../components/Map'), { ssr: false });

export default function Home({ geojsonData }) {
  const [selectedBasin, setSelectedBasin] = useState(null); // Store selected basin
  const [loading, setLoading] = useState(true); // Loading state

  // Define Joyride steps
  const steps = [
    { 
      target: 'body', // Full-page focus
      content: (
        <div>
          <h2 style={{ color: '#fff', fontSize: '24px' }}>Welcome to the Page!</h2>
          <p style={{ color: '#ddd', fontSize: '16px' }}>
            This is an interactive guide to help you navigate the features of this page.
          </p>
          <p style={{ color: '#ddd', fontSize: '14px' }}>
            Click Next to begin the tour.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
      spotlightPadding: 0, // Remove padding to dim the entire page
      styles: {
        options: {
          zIndex: 10000, // Keep on top
          backgroundColor: 'rgba(0, 0, 0, 0.6)', // Lighter dimmed background
        },
        tooltip: {
          backgroundColor: '#222', // Tooltip background for better contrast
          padding: '20px', // Increase padding for better spacing
          borderRadius: '8px', // Rounded corners for a cleaner look
          maxWidth: '400px', // Limit width for a focused layout
        },
        tooltipTitle: {
          fontSize: '20px',
          fontWeight: 'bold',
        },
        tooltipContent: {
          textAlign: 'center',
          color: '#ddd',
        },
        buttonNext: {
          backgroundColor: '#ff3366', // Match branding or more vibrant colors
          color: '#fff',
        },
        buttonSkip: {
          color: '#fff',
          opacity: 0.7,
        },
      },
    },
    {
      target: '.map-container', // Map container
      content: 'This is the interactive map. Click on a basin to explore water scarcity data.',
      placement: 'right',
    },
    {
      target: '.bar-chart-container', // Bar Chart container
      content: 'Here you can see a bar chart representing water scarcity data.',
      placement: 'left',
    },
    {
      target: '.tree-map-container', // Tree Map container
      content: 'This section shows a tree map with the area being water scarcity level multiplied by population. This is to highlight the total effect.',
      placement: 'left',
    },
  ];

  // Handle loading state
  useEffect(() => {
    if (geojsonData) {
      setLoading(false);
    }
  }, [geojsonData]);

  // Map area selection handler
  const onMapAreaSelect = (areaId) => {
    setSelectedBasin(areaId); // Update selected basin on map click
  };

  if (loading) {
    // Render loading screen while data is being fetched
    return (
      <div className="spinner">
        <div>
          <h2>Loading...</h2>
          <p>Fetching data and preparing the map...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Joyride for the guide animation */}
      <Joyride
        steps={steps}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        styles={{
          options: {
            zIndex: 10000, // Ensure Joyride appears above other elements
          },
        }}
      />

      <div className="element">
        <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Water Scarcity Through Time</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gridTemplateRows: 'auto auto',
          columnGap: '10px',
        }}
      >
        {/* Map Section */}
        <div
          className="map-container" // Add class for Joyride targeting
          style={{
            gridColumn: '1 / 2',
            gridRow: '1 / 3',
            border: '1px solid #ccc',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <Map geojsonData={geojsonData} onMapAreaSelect={onMapAreaSelect} selectedMapArea={selectedBasin} />
        </div>

        {/* Bar Chart Section */}
        <div
          className="bar-chart-container" // Add class for Joyride targeting
          style={{
            gridColumn: '2 / 3',
            gridRow: '1 / 2',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '0px',
            minHeight: '260px',
          }}
        >
          <BarChart data={geojsonData.features} selectedBasin={selectedBasin} />
        </div>

        {/* TreeMap Section */}
        <div
          className="tree-map-container" // Add class for Joyride targeting
          style={{
            gridColumn: '2 / 3',
            gridRow: '2 / 3',
            border: 'none',
            padding: '0px',
          }}
        >
          <TreeMap geojsonData={geojsonData} setSelectedBasin={setSelectedBasin} />
        </div>
      </div>
    </div>
  );
}

// Server-side props to fetch GeoJSON data
export async function getServerSideProps() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'updated_mrb_basins.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const geojsonData = JSON.parse(fileContent);

    return {
      props: {
        geojsonData,
      },
    };
  } catch (error) {
    console.error('Error loading GeoJSON data:', error);
    return {
      props: {
        geojsonData: null,
      },
    };
  }
}
