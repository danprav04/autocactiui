import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mapUrl, setMapUrl] = useState('');
  
  const initialIpRef = useRef(null);

  const addNode = useCallback((device, position) => {
    // Prevent adding the same node twice
    const existingNode = nodes.find(n => n.id === device.ip);
    if (existingNode) {
      return existingNode;
    }

    const newNode = {
      id: device.ip,
      data: { label: `${device.hostname}\n(${device.ip})` },
      position: position || { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes(prevNodes => [...prevNodes, newNode]);
    return newNode;
  }, [nodes]);

  const handleFetchNeighbors = useCallback(async (ip) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await axios.get(`${API_BASE_URL}/api/devices/${ip}/neighbors`);
      // Filter out neighbors that are already on the map
      setNeighbors(response.data.filter(n => !nodes.some(node => node.id === n.ip)));
    } catch (err) {
      setError(`Could not fetch neighbors for IP ${ip}.`);
      setNeighbors([]);
    } finally {
      setIsLoading(false);
    }
  }, [nodes]);
  
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    handleFetchNeighbors(node.id);
  }, [handleFetchNeighbors]);

  const handleAddNeighbor = useCallback((neighborDevice) => {
    if (!selectedNode) {
      setError("Please select a node on the map before adding a neighbor.");
      return;
    }
    
    // Add the new device as a node
    addNode(neighborDevice);
    
    // Automatically add the edge between the selected node and its new neighbor
    const newEdge = { 
      id: `e-${selectedNode.id}-${neighborDevice.ip}`, 
      source: selectedNode.id, 
      target: neighborDevice.ip, 
      animated: true 
    };
    setEdges(prevEdges => [...prevEdges, newEdge]);
    
    // Remove the newly added neighbor from the list
    setNeighbors(prev => prev.filter(n => n.ip !== neighborDevice.ip));

  }, [addNode, selectedNode]);
  
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
    setSelectedNode(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/devices`, { ip });
      const initialDevice = response.data;
      const newNode = addNode(initialDevice, { x: 250, y: 250 });
      setSelectedNode(newNode); // Set the first node as selected
      handleFetchNeighbors(initialDevice.ip);
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
      const response = await axios.post(`${API_BASE_URL}/api/maps`, { nodes, edges });
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
        selectedNode={selectedNode}
        neighbors={neighbors}
        onAddNeighbor={handleAddNeighbor}
        onGenerateMap={handleGenerateMap}
        disabled={nodes.length === 0}
      />
      <div className="main-content">
        <h1>Interactive Network Map Creator</h1>
        {nodes.length === 0 ? (
          <form className="start-form" onSubmit={handleStart}>
            <input type="text" ref={initialIpRef} placeholder="Enter starting device IP (e.g., 189.1.5.5)" defaultValue="189.1.5.5" />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Start Mapping'}
            </button>
          </form>
        ) : (
          <Map nodes={nodes} edges={edges} onNodeClick={onNodeClick} />
        )}
        {error && <p className="error-message">{error}</p>}
        {isLoading && <p className="loading-message">Loading...</p>}

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