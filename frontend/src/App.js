// frontend/src/App.js
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';

import Map from './components/Map';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';
import GroupNode from './components/GroupNode';
import StartupScreen from './components/Startup/StartupScreen';
import ThemeToggleButton from './components/common/ThemeToggleButton';
import LanguageSwitcher from './components/common/LanguageSwitcher';
import * as api from './services/apiService';
import { handleUploadProcess } from './services/mapExportService';
import { ICONS_BY_THEME } from './config/constants';
import './App.css';

// Create a context to provide the update function directly to node components
export const NodeContext = React.createContext(null);

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mapName, setMapName] = useState('My-Network-Map');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [cactiInstallations, setCactiInstallations] = useState([]);
  const [selectedCactiId, setSelectedCactiId] = useState('');
  
  const { t, i18n } = useTranslation();
  const reactFlowWrapper = useRef(null);
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: GroupNode }), []);
  const availableIcons = useMemo(() => Object.keys(ICONS_BY_THEME).filter(k => k !== 'Unknown'), []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    // Set text direction based on the current language
    const dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
  }, [i18n.language]);

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
            setError(t('app.errorCacti'));
            console.error(err);
        }
    };
    fetchCactiInstallations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (nodes.length > 0) {
        setNodes(nds =>
            nds.map(node => {
                if (node.type !== 'custom') return node;
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
    const discoveredType = device.type;
    let finalIconName = explicitIconName;

    if (!finalIconName) {
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
      zIndex: 10
    };
  }, [theme]);

  const handleFetchNeighbors = useCallback(async (ip) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.getDeviceNeighbors(ip);
      setNeighbors(response.data.neighbors.filter(n => !nodes.some(node => node.id === n.ip)));
    } catch (err) {
      setError(t('app.errorFetchNeighbors', { ip }));
      setNeighbors([]);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, t]);
  
  const onNodeClick = useCallback((event, node) => {
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
    setSelectedElement(node);
    if (node.type === 'custom') {
        handleFetchNeighbors(node.id);
    } else {
        setNeighbors([]);
    }
  }, [handleFetchNeighbors]);

  const onPaneClick = useCallback(() => {
      setNodes(nds => nds.map(n => ({...n, selected: false})));
      setSelectedElement(null);
      setNeighbors([]);
  }, []);

  const handleAddNeighbor = useCallback(async (neighbor) => {
    if (!selectedElement || selectedElement.type !== 'custom' || nodes.some(n => n.id === neighbor.ip)) return;
    
    setIsLoading(true);
    setError('');
    try {
      const deviceResponse = await api.getDeviceInfo(neighbor.ip);
      if (!deviceResponse.data || deviceResponse.data.error) throw new Error(`No info for ${neighbor.ip}`);
      
      const newPosition = { x: selectedElement.position.x + (Math.random() * 250 - 125), y: selectedElement.position.y + 150 };
      const newNode = createNodeObject(deviceResponse.data, newPosition);

      const primaryEdgeToAdd = {
          id: `e-${selectedElement.id}-${newNode.id}`,
          source: selectedElement.id,
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
        setError(t('app.errorAddNeighbor', {ip: neighbor.ip}));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [createNodeObject, selectedElement, nodes, edges, t]);

  const handleDeleteNode = useCallback(() => {
    if (!selectedElement) return;
    const elementIdToDelete = selectedElement.id;

    if (selectedElement.type === 'custom') { // It's a device node
        setEdges(eds => eds.filter(e => e.source !== elementIdToDelete && e.target !== elementIdToDelete));
    }
    
    setNodes(nds => nds.filter(n => n.id !== elementIdToDelete));
    setSelectedElement(null);
    setNeighbors([]);
  }, [selectedElement]);
  
  const handleUpdateNodeData = useCallback((nodeId, updatedData) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        let finalData = { ...n.data, ...updatedData };
        if (n.type === 'custom') {
            const newIconType = updatedData.iconType || n.data.iconType;
            finalData.icon = ICONS_BY_THEME[newIconType][theme];
        }
        
        const updatedNode = { ...n, data: finalData };
        
        if (selectedElement && selectedElement.id === nodeId) {
          setSelectedElement(updatedNode);
        }
        return updatedNode;
      }
      return n;
    }));
  }, [theme, selectedElement]);
  
  const handleAddGroup = useCallback(() => {
    const newGroupId = `group_${Date.now()}`;
    const newGroup = {
      id: newGroupId,
      type: 'group',
      position: { x: 200, y: 200 },
      data: {
        label: 'New Group',
        color: '#cfe2ff', // A light, neutral default color
        width: 400,
        height: 300,
        opacity: 0.6 // Default opacity
      },
      zIndex: 0 // Ensure groups are rendered behind device nodes
    };
    setNodes(nds => [...nds, newGroup]);
  }, []);

  const handleStart = async (ip, initialIconName) => {
    if (!ip) { setError(t('app.errorStartIp')); return; }
    
    setIsLoading(true);
    setError('');
    setSelectedElement(null);
    try {
      const response = await api.getInitialDevice(ip);
      const newNode = createNodeObject(response.data, { x: 400, y: 150 }, initialIconName);
      setNodes([newNode]);
      setEdges([]);
      onNodeClick(null, newNode);
    } catch (err) {
      setError(t('app.errorInitialDevice'));
      setNodes([]);
      setEdges([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadMap = async () => {
    if (!reactFlowWrapper.current || nodes.length === 0) { setError(t('app.errorEmptyMap')); return; }
    if (!selectedCactiId) { setError(t('app.errorSelectCacti')); return; }
    
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
      setError(t('app.errorUpload'));
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <NodeContext.Provider value={{ onUpdateNodeData: handleUpdateNodeData }}>
      <div className="app-container">
        <Sidebar 
          selectedElement={selectedElement}
          neighbors={neighbors}
          onAddNeighbor={handleAddNeighbor}
          onDeleteNode={handleDeleteNode}
          onUpdateNodeData={handleUpdateNodeData}
          onUploadMap={handleUploadMap}
          onAddGroup={handleAddGroup}
          availableIcons={availableIcons}
          mapName={mapName}
          setMapName={setMapName}
          isMapStarted={nodes.length > 0}
          isUploading={isUploading}
          cactiInstallations={cactiInstallations}
          selectedCactiId={selectedCactiId}
          setSelectedCactiId={setSelectedCactiId}
        />
        <div className="main-content" ref={reactFlowWrapper}>
          <div className="top-controls">
            <LanguageSwitcher />
            <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
          </div>
          {nodes.length === 0 ? (
            <StartupScreen 
              onStart={handleStart} 
              isLoading={isLoading}
              availableIcons={availableIcons}
            />
          ) : (
            <Map 
              nodes={nodes} 
              edges={edges} 
              onNodeClick={onNodeClick} 
              onNodesChange={onNodesChange}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes} 
              theme={theme}
            />
          )}
          {error && <p className="error-message">{error}</p>}
          {isLoading && !error && <p className="loading-message">{t('app.loading')}</p>}
        </div>
      </div>
    </NodeContext.Provider>
  );
}

export default App;