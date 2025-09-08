// frontend/src/App.js
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';

import Map from './components/Map';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';
import StartupScreen from './components/Startup/StartupScreen';
import ThemeToggleButton from './components/common/ThemeToggleButton';
import * as api from './services/apiService';
import { handleUploadProcess } from './services/mapExportService';
import { ICONS_BY_THEME, INITIAL_ICON_NAME } from './config/constants';
import './App.css';

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [initialIconName, setInitialIconName] = useState(INITIAL_ICON_NAME);
  const [mapName, setMapName] = useState('My-Network-Map');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [cactiInstallations, setCactiInstallations] = useState([]);
  const [selectedCactiId, setSelectedCactiId] = useState('');
  
  const reactFlowWrapper = useRef(null);
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchCactiInstallations = async () => {
        try {
            const response = await api.getAllCactiInstallations();
            const installations = response.data.data;
            if (response.data.status === 'success' && installations.length > 0) {
                setCactiInstallations(installations);
                setSelectedCactiId(installations[0].id);
            }
        } catch (err) {
            setError('Could not fetch Cacti installations.');
            console.error(err);
        }
    };
    fetchCactiInstallations();
  }, []);

  useEffect(() => {
    if (nodes.length > 0) {
        setNodes(nds =>
            nds.map(node => {
                const iconType = node.data.iconType;
                if (iconType && ICONS_BY_THEME[iconType]) {
                    return { ...node, data: { ...node.data, icon: ICONS_BY_THEME[iconType][theme] } };
                }
                return node;
            })
        );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  const onNodesChange = useCallback((changes) => setNodes(nds => applyNodeChanges(changes, nds)), []);

  const createNodeObject = useCallback((device, position, explicitIconName) => {
    // If an explicit icon name is provided (from the initial dropdown), use it.
    // Otherwise, determine the icon type from the device data.
    const discoveredType = device.type;
    let finalIconName = explicitIconName;

    if (!finalIconName) {
      // If the discovered type is a key in our icon map, use it. Otherwise, mark as 'Unknown'.
      finalIconName = ICONS_BY_THEME[discoveredType] ? discoveredType : 'Unknown';
    }
    
    return {
      id: device.ip,
      type: 'custom',
      position: position || { x: (Math.random() * 400) + 100, y: (Math.random() * 400) + 50 },
      data: { 
        hostname: device.hostname, 
        ip: device.ip,
        iconType: finalIconName,
        icon: ICONS_BY_THEME[finalIconName][theme]
      },
    };
  }, [theme]);

  const handleFetchNeighbors = useCallback(async (ip) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.getDeviceNeighbors(ip);
      setNeighbors(response.data.neighbors.filter(n => !nodes.some(node => node.id === n.ip)));
    } catch (err) {
      setError(`Could not fetch neighbors for IP ${ip}.`);
      setNeighbors([]);
    } finally {
      setIsLoading(false);
    }
  }, [nodes]);
  
  const onNodeClick = useCallback((event, node) => {
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
    setSelectedNode(node);
    handleFetchNeighbors(node.id);
  }, [handleFetchNeighbors]);

  const handleAddNeighbor = useCallback(async (neighbor) => {
    if (!selectedNode || nodes.some(n => n.id === neighbor.ip)) return;
    
    setIsLoading(true);
    setError('');
    try {
      const deviceResponse = await api.getDeviceInfo(neighbor.ip);
      if (!deviceResponse.data || deviceResponse.data.error) throw new Error(`No info for ${neighbor.ip}`);
      
      const newPosition = { x: selectedNode.position.x + (Math.random() * 250 - 125), y: selectedNode.position.y + 150 };
      const newNode = createNodeObject(deviceResponse.data, newPosition);

      const primaryEdgeToAdd = {
          id: `e-${selectedNode.id}-${newNode.id}`,
          source: selectedNode.id,
          target: newNode.id,
          animated: true,
          style: { stroke: '#6c757d' },
          data: { interface: neighbor.interface }
      };
      
      const newNeighborsResponse = await api.getDeviceNeighbors(newNode.id);
      const newDeviceNeighbors = newNeighborsResponse.data.neighbors || [];
      
      const allNodes = [...nodes, newNode];
      const allCurrentEdges = [...edges, primaryEdgeToAdd]; 

      const secondaryEdgesToAdd = newDeviceNeighbors.reduce((acc, newNeighbor) => {
          const existingNode = allNodes.find(n => n.id === newNeighbor.ip);
          
          if (existingNode && !allCurrentEdges.some(e => (e.source === newNode.id && e.target === existingNode.id) || (e.source === existingNode.id && e.target === newNode.id))) {
              acc.push({ 
                  id: `e-${newNode.id}-${existingNode.id}`, 
                  source: newNode.id, 
                  target: existingNode.id, 
                  animated: true, 
                  style: { stroke: '#6c757d' },
                  data: { interface: newNeighbor.interface }
              });
          }
          return acc;
      }, []);

      setNodes(prev => [...prev, newNode]);
      setEdges(prev => [...prev, primaryEdgeToAdd, ...secondaryEdgesToAdd]);
      setNeighbors(prev => prev.filter(n => n.ip !== neighbor.ip));
    } catch(err) {
        setError(`Failed to add neighbor ${neighbor.ip}.`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [createNodeObject, selectedNode, nodes, edges]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNode) return;
    const nodeIdToDelete = selectedNode.id;
    setNodes(nds => nds.filter(n => n.id !== nodeIdToDelete));
    setEdges(eds => eds.filter(e => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete));
    setSelectedNode(null);
    setNeighbors([]);
  }, [selectedNode]);
  
  const handleUpdateNodeType = useCallback((nodeId, newType) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const updatedNode = {
          ...n,
          data: {
            ...n.data,
            iconType: newType,
            icon: ICONS_BY_THEME[newType][theme],
          },
        };
        // If the updated node is the currently selected one, update the selection as well
        if (selectedNode && selectedNode.id === nodeId) {
          setSelectedNode(updatedNode);
        }
        return updatedNode;
      }
      return n;
    }));
  }, [theme, selectedNode]);

  const handleStart = async (ip) => {
    if (!ip) { setError('Please enter a starting IP address.'); return; }
    
    setIsLoading(true);
    setError('');
    setSelectedNode(null);
    try {
      const response = await api.getInitialDevice(ip);
      // The explicit icon name from the dropdown is used only for the very first device
      const newNode = createNodeObject(response.data, { x: 400, y: 150 }, initialIconName);
      setNodes([newNode]);
      setEdges([]);
      onNodeClick(null, newNode);
    } catch (err) {
      setError('Failed to find the initial device. Please check the IP and try again.');
      setNodes([]);
      setEdges([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadMap = async () => {
    if (!reactFlowWrapper.current || nodes.length === 0) { setError('Cannot upload an empty map.'); return; }
    if (!selectedCactiId) { setError('Please select a Cacti installation first.'); return; }
    
    setIsUploading(true);
    setError('');
    try {
      await handleUploadProcess({
        mapElement: reactFlowWrapper.current,
        nodes,
        edges,
        mapName,
        cactiId: selectedCactiId,
        theme,
        setNodes,
        setEdges
      });
    } catch (err) {
      setError('Failed to upload map to Cacti.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        selectedNode={selectedNode}
        neighbors={neighbors}
        onAddNeighbor={handleAddNeighbor}
        onDeleteNode={handleDeleteNode}
        onUpdateNodeType={handleUpdateNodeType}
        onUploadMap={handleUploadMap}
        availableIcons={Object.keys(ICONS_BY_THEME).filter(k => k !== 'Unknown')}
        initialIconName={initialIconName}
        setInitialIconName={setInitialIconName}
        mapName={mapName}
        setMapName={setMapName}
        disabled={nodes.length === 0}
        isUploading={isUploading}
        cactiInstallations={cactiInstallations}
        selectedCactiId={selectedCactiId}
        setSelectedCactiId={setSelectedCactiId}
      />
      <div className="main-content" ref={reactFlowWrapper}>
        <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
        {nodes.length === 0 ? (
          <StartupScreen onStart={handleStart} isLoading={isLoading} />
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