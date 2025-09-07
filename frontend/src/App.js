import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { applyNodeChanges } from 'react-flow-renderer';
import { toBlob } from 'html-to-image';

import Map from './components/Map';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';
import { generateCactiConfig } from './services/configGenerator';
import './App.css';

// Import new theme-aware icons
import routerBlackIcon from './assets/icons/router-black.png';
import routerWhiteIcon from './assets/icons/router-white.png';
import switchBlackIcon from './assets/icons/switch-black.png';
import switchWhiteIcon from './assets/icons/switch-white.png';
import firewallIcon from './assets/icons/firewall.png'; // This icon is used for both themes

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Define a structure for theme-based icons
const ICONS_BY_THEME = {
  'Router': { light: routerBlackIcon, dark: routerWhiteIcon },
  'Switch': { light: switchBlackIcon, dark: switchWhiteIcon },
  'Firewall': { light: firewallIcon, dark: firewallIcon }, // Fallback to the same icon
};
const DEFAULT_ICON_NAME = 'Router';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentIconName, setCurrentIconName] = useState(DEFAULT_ICON_NAME);
  const [mapName, setMapName] = useState('My-Network-Map');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [cactiInstallations, setCactiInstallations] = useState([]);
  const [selectedCactiId, setSelectedCactiId] = useState('');
  
  const reactFlowWrapper = useRef(null);
  const initialIpRef = useRef(null);
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Effect to apply the theme to the document body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effect to fetch cacti installations on component mount
  useEffect(() => {
    const fetchCactiInstallations = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/get-all-cacti-installations`);
            if (response.data.status === 'success' && response.data.data.length > 0) {
                setCactiInstallations(response.data.data);
                setSelectedCactiId(response.data.data[0].id);
            }
        } catch (err) {
            setError('Could not fetch Cacti installations.');
            console.error(err);
        }
    };
    fetchCactiInstallations();
  }, []);

  // Effect to update node icons when the theme changes
  useEffect(() => {
    if (nodes.length > 0) {
        setNodes(nds =>
            nds.map(node => {
                if (node.data.iconType && ICONS_BY_THEME[node.data.iconType]) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            icon: ICONS_BY_THEME[node.data.iconType][theme],
                        },
                    };
                }
                return node;
            })
        );
    }
  }, [theme, nodes.length]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

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
        iconType: iconName,
        icon: ICONS_BY_THEME[iconName][theme]
      },
    };
    setNodes(prevNodes => [...prevNodes, newNode]);
    return newNode;
  }, [nodes, theme]);

  const handleFetchNeighbors = useCallback(async (ip) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/get-device-neighbors/${ip}`);
      setNeighbors(response.data.neighbors.filter(n => !nodes.some(node => node.id === n.ip)));
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

  const handleAddNeighbor = useCallback((neighbor) => {
    if (!selectedNode) {
      setError("Please select a node on the map before adding a neighbor.");
      return;
    }
    
    const newPosition = {
        x: selectedNode.position.x + Math.random() * 200 - 100,
        y: selectedNode.position.y + 120,
    };

    const deviceToAdd = { ip: neighbor.ip, hostname: neighbor.neighbor };
    addNode(deviceToAdd, newPosition, currentIconName);
    
    const newEdge = { 
      id: `e-${selectedNode.id}-${neighbor.ip}`, 
      source: selectedNode.id, 
      target: neighbor.ip, 
      animated: true,
      style: { stroke: '#6c757d' },
      data: { interface: neighbor.interface } // Store interface name from neighbor data
    };
    setEdges(prevEdges => [...prevEdges, newEdge]);
    setNeighbors(prev => prev.filter(n => n.ip !== neighbor.ip));
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

  const handleUploadMap = async () => {
    const mapElement = reactFlowWrapper.current;
    if (!mapElement) {
        setError('Could not find map element to upload.');
        return;
    }
    if (!selectedCactiId) {
        setError('Please select a Cacti installation first.');
        return;
    }
    
    setIsUploading(true);
    setError('');

    const wasDarkTheme = theme === 'dark';
    const originalNodes = nodes;
    const originalEdges = edges;

    const exportNodes = nodes.map(node => ({
        ...node,
        selected: false,
        data: {
            ...node.data,
            icon: ICONS_BY_THEME[node.data.iconType].light
        }
    }));
    
    const exportEdges = edges.map(edge => ({
        ...edge,
        animated: false,
        type: 'straight',
        style: { stroke: '#000000', strokeWidth: 2 }
    }));

    setNodes(exportNodes);
    setEdges(exportEdges);
    mapElement.classList.add('exporting');
    if (wasDarkTheme) {
        document.body.setAttribute('data-theme', 'light');
    }
    
    setTimeout(() => {
        const viewport = mapElement.querySelector('.react-flow__viewport');
        if (!viewport) {
            setError('Could not find map viewport for export.');
            setIsUploading(false);
            return;
        }

        const imageWidth = 1920;
        const imageHeight = 1080;
        const padding = 75;

        const nodeWidth = 100;
        const nodeHeight = 80;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (originalNodes.length === 0) {
            minX = 0; minY = 0; maxX = imageWidth; maxY = imageHeight;
        } else {
            originalNodes.forEach(node => {
                minX = Math.min(minX, node.position.x);
                minY = Math.min(minY, node.position.y);
                maxX = Math.max(maxX, node.position.x + nodeWidth);
                maxY = Math.max(maxY, node.position.y + nodeHeight);
            });
        }

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;

        const scaleX = (imageWidth - padding * 2) / boundsWidth;
        const scaleY = (imageHeight - padding * 2) / boundsHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        const scaledWidth = boundsWidth * scale;
        const scaledHeight = boundsHeight * scale;
        const translateX = (-minX * scale) + (imageWidth - scaledWidth) / 2;
        const translateY = (-minY * scale) + (imageHeight - scaledHeight) / 2;
        
        const originalTransform = viewport.style.transform;
        viewport.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

        toBlob(viewport, { 
            width: imageWidth,
            height: imageHeight,
            backgroundColor: '#ffffff',
            filter: (node) => (node.className !== 'react-flow__controls'),
        })
        .then(async (blob) => {
            if (!blob) {
                throw new Error('Failed to create image blob.');
            }
            const configContent = generateCactiConfig(originalNodes, originalEdges, mapName);
            const formData = new FormData();
            formData.append('map_image', blob, `${mapName}.png`);
            formData.append('config_content', configContent);
            formData.append('map_name', mapName);
            formData.append('cacti_installation_id', selectedCactiId);

            await axios.post(`${API_BASE_URL}/upload-map`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        })
        .catch((err) => {
            setError('Failed to upload map to Cacti.');
            console.error(err);
        })
        .finally(() => {
            viewport.style.transform = originalTransform;
            mapElement.classList.remove('exporting');
            if (wasDarkTheme) {
                document.body.setAttribute('data-theme', 'dark');
            }
            setNodes(originalNodes);
            setEdges(originalEdges);
            setIsUploading(false);
        });
    }, 200);
  };


  const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
  );

  const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
  );

  return (
    <div className="app-container">
      <Sidebar 
        selectedNode={selectedNode}
        neighbors={neighbors}
        onAddNeighbor={handleAddNeighbor}
        onUploadMap={handleUploadMap}
        availableIcons={Object.keys(ICONS_BY_THEME)}
        currentIconName={currentIconName}
        setCurrentIconName={setCurrentIconName}
        mapName={mapName}
        setMapName={setMapName}
        disabled={nodes.length === 0}
        isUploading={isUploading}
        cactiInstallations={cactiInstallations}
        selectedCactiId={selectedCactiId}
        setSelectedCactiId={setSelectedCactiId}
      />
      <div className="main-content" ref={reactFlowWrapper}>
        <button onClick={toggleTheme} className="theme-toggle-button" title="Toggle Theme">
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>

        {nodes.length === 0 ? (
          <div className="start-container">
            <h1>Interactive Network Map Creator</h1>
            <form className="start-form" onSubmit={handleStart}>
              <input type="text" ref={initialIpRef} placeholder="Enter starting device IP" defaultValue="10.10.1.3" />
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Start Mapping'}
              </button>
            </form>
          </div>
        ) : (
          <Map 
            nodes={nodes} 
            edges={edges} 
            onNodeClick={onNodeClick} 
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes} 
            theme={theme}
          />
        )}
        {error && <p className="error-message">{error}</p>}
        {isLoading && !error && <p className="loading-message">Loading...</p>}
      </div>
    </div>
  );
}

export default App;