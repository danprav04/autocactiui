import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [neighbors, setNeighbors] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mapUrl, setMapUrl] = useState('');
  
  const initialIpRef = useRef(null);

  const addNode = useCallback((device, position) => {
    // Prevent adding the same node twice
    if (nodes.find(n => n.id === device.ip)) return;

    const newNode = {
      id: device.ip,
      data: { label: `${device.hostname}\n(${device.ip})` },
      position: position || { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes(prevNodes => [...prevNodes, newNode]);
  }, [nodes]);

  const handleFetchNeighbors = useCallback(async (device) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await axios.get(`/api/devices/${device.ip}/neighbors`);
      setNeighbors(response.data);
    } catch (err) {
      setError(`Could not fetch neighbors for ${device.hostname}.`);
      setNeighbors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAddNeighbor = useCallback((neighborDevice, sourceDeviceIp) => {
    addNode(neighborDevice, { x: Math.random() * 400, y: Math.random() * 400 });
    const newEdge = { id: `e-${sourceDeviceIp}-${neighborDevice.ip}`, source: sourceDeviceIp, target: neighborDevice.ip, animated: true };
    setEdges(prevEdges => [...prevEdges, newEdge]);
    handleFetchNeighbors(neighborDevice);
  }, [addNode, handleFetchNeighbors]);
  
  const handleStart = async (e) => {
    e.preventDefault();
    const ip = initialIpRef.current.value;
    if (!ip) {
      setError('Please enter a starting IP address.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setNodes([]);
    setEdges([]);
    setMapUrl('');

    try {
      const response = await axios.post('/api/devices', { ip });
      const initialDevice = response.data;
      addNode(initialDevice, { x: 250, y: 250 });
      handleFetchNeighbors(initialDevice);
    } catch (err) {
      setError('Failed to find the initial device. Please check the IP and try again.');
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMap = async () => {
    if (nodes.length === 0) {
      setError('Cannot generate a map with no devices.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/maps', { nodes, edges });
      setMapUrl(response.data.map_url);
    } catch (err) {
      setError('Failed to generate the map image.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        neighbors={neighbors}
        onAddNeighbor={handleAddNeighbor}
        onGenerateMap={handleGenerateMap}
        disabled={nodes.length === 0}
      />
      <div className="main-content">
        <h1>Interactive Network Map Creator</h1>
        {nodes.length === 0 ? (
          <form className="start-form" onSubmit={handleStart}>
            <input type="text" ref={initialIpRef} placeholder="Enter starting device IP (e.g., 189.1.5.5)" />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Start Mapping'}
            </button>
          </form>
        ) : (
          <Map nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges} />
        )}
        {error && <p className="error-message">{error}</p>}
        {isLoading && nodes.length > 0 && <p className="loading-message">Loading...</p>}

        {mapUrl && (
          <div className="map-result">
            <h2>Generated Map</h2>
            <img src={mapUrl} alt="Generated Network Map" />
            <a href={mapUrl} download="network-map.png">Download Map</a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;