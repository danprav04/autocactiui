import React, { useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { applyNodeChanges } from 'react-flow-renderer';
import { toPng } from 'html-to-image';

import Map from './components/Map';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';
import { generateCactiConfig } from './services/configGenerator';
import './App.css';

import routerIcon from './assets/icons/router.png';
import switchIcon from './assets/icons/switch.png';
import firewallIcon from './assets/icons/firewall.png';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const AVAILABLE_ICONS = {
  'Router': routerIcon,
  'Switch': switchIcon,
  'Firewall': firewallIcon,
};
const DEFAULT_ICON_NAME = 'Router';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentIconName, setCurrentIconName] = useState(DEFAULT_ICON_NAME);
  const [mapName, setMapName] = useState('My-Network-Map');
  
  const reactFlowWrapper = useRef(null);
  const initialIpRef = useRef(null);
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const addNode = useCallback((device, position, iconName) => {
    const existingNode = nodes.find(n => n.id === device.ip);
    if (existingNode) return existingNode;

    const newNode = {
      id: device.ip,
      type: 'custom',
      position: position || { x: (Math.random() * 400) + 100, y: (Math.random() * 400) + 50 },
      data: { 
        hostname: device.hostname, 
        ip: device.ip,
        icon: AVAILABLE_ICONS[iconName]
      },
    };
    setNodes(prevNodes => [...prevNodes, newNode]);
    return newNode;
  }, [nodes]);

  const handleFetchNeighbors = useCallback(async (ip) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/devices/${ip}/neighbors`);
      setNeighbors(response.data.filter(n => !nodes.some(node => node.id === n.ip)));
    } catch (err) {
      setError(`Could not fetch neighbors for IP ${ip}.`);
      setNeighbors([]);
    } finally {
      setIsLoading(false);
    }
  }, [nodes]);
  
  const onNodeClick = useCallback((event, node) => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
    setSelectedNode(node);
    handleFetchNeighbors(node.id);
  }, [handleFetchNeighbors]);

  const handleAddNeighbor = useCallback((neighborDevice) => {
    if (!selectedNode) {
      setError("Please select a node on the map before adding a neighbor.");
      return;
    }
    
    const newPosition = {
        x: selectedNode.position.x + Math.random() * 200 - 100,
        y: selectedNode.position.y + 120,
    };
    addNode(neighborDevice, newPosition, currentIconName);
    
    const newEdge = { 
      id: `e-${selectedNode.id}-${neighborDevice.ip}`, 
      source: selectedNode.id, 
      target: neighborDevice.ip, 
      animated: true,
      style: { stroke: '#6c757d' }
    };
    setEdges(prevEdges => [...prevEdges, newEdge]);
    setNeighbors(prev => prev.filter(n => n.ip !== neighborDevice.ip));
  }, [addNode, selectedNode, currentIconName]);
  
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
    setSelectedNode(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/devices`, { ip });
      const initialDevice = response.data;
      const newNode = addNode(initialDevice, { x: 400, y: 150 }, currentIconName);
      onNodeClick(null, newNode);
    } catch (err) {
      setError('Failed to find the initial device. Please check the IP and try again.');
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = () => {
    const mapElement = reactFlowWrapper.current;
    if (!mapElement) {
        setError('Could not find map to download.');
        return;
    }

    // --- Prepare for a clean export ---
    const originalEdges = edges;
    // 1. Deselect all nodes
    setNodes(nds => nds.map(n => ({...n, selected: false})));
    // 2. Change edges to be straight lines for the export
    setEdges(eds => eds.map(e => ({...e, type: 'straight', animated: false})));
    // 3. Add a temporary class to the wrapper to hide UI elements via CSS
    mapElement.classList.add('exporting');
    
    // Use a timeout to allow React to re-render with the changes before capturing
    setTimeout(() => {
        toPng(mapElement.querySelector('.react-flow__viewport'), { 
            cacheBust: true,
            backgroundColor: '#ffffff',
            filter: (node) => (node.className !== 'react-flow__controls'),
        })
        .then((dataUrl) => {
            const link = document.createElement('a');
            link.download = `${mapName}.png`;
            link.href = dataUrl;
            link.click();
        })
        .catch((err) => {
            setError('Could not generate map image.');
            console.error(err);
        })
        .finally(() => {
            // --- Cleanup after export ---
            // 1. Restore original edges
            setEdges(originalEdges);
            // 2. Remove the temporary export class
            mapElement.classList.remove('exporting');
        });
    }, 100);
  };

  const handleDownloadConfig = () => {
    try {
        const configContent = generateCactiConfig(nodes, edges, mapName);
        const blob = new Blob([configContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${mapName}.conf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        setError("Failed to generate config file.");
        console.error(err);
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        selectedNode={selectedNode}
        neighbors={neighbors}
        onAddNeighbor={handleAddNeighbor}
        onDownloadImage={handleDownloadImage}
        onDownloadConfig={handleDownloadConfig}
        availableIcons={Object.keys(AVAILABLE_ICONS)}
        currentIconName={currentIconName}
        setCurrentIconName={setCurrentIconName}
        mapName={mapName}
        setMapName={setMapName}
        disabled={nodes.length === 0}
      />
      <div className="main-content" ref={reactFlowWrapper}>
        <h1>Interactive Network Map Creator</h1>
        {nodes.length === 0 ? (
          <form className="start-form" onSubmit={handleStart}>
            <input type="text" ref={initialIpRef} placeholder="Enter starting device IP" defaultValue="10.10.1.3" />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Start Mapping'}
            </button>
          </form>
        ) : (
          <Map 
            nodes={nodes} 
            edges={edges} 
            onNodeClick={onNodeClick} 
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes} 
          />
        )}
        {error && <p className="error-message">{error}</p>}
        {isLoading && <p className="loading-message">Loading...</p>}
      </div>
    </div>
  );
}

export default App;