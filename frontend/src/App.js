// frontend/src/App.js
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ReactFlowProvider } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';

import { useThemeManager } from './hooks/useThemeManager';
import { useLocalizationManager } from './hooks/useLocalizationManager';
import { useCacti } from './hooks/useCacti';
import { useMapInteraction } from './hooks/useMapInteraction';

import Map from './components/Map';
import Sidebar from './components/Sidebar/Sidebar';
import CustomNode from './components/CustomNode';
import GroupNode from './components/GroupNode';
import TextNode from './components/TextNode';
import StartupScreen from './components/Startup/StartupScreen';
import LoginScreen from './components/Login/LoginScreen';
import TopToolbar from './components/TopToolbar/TopToolbar';
import ContextMenu from './components/ContextMenu/ContextMenu';
import UploadSuccessPopup from './components/common/UploadSuccessPopup';
import NeighborsPopup from './components/common/NeighborsPopup';

import * as api from './services/apiService';
import { handleUploadProcess } from './services/mapExportService';
import { ICONS_BY_THEME } from './config/constants';
import './App.css';
import './components/TopToolbar/TopToolbar.css';
import './components/ContextMenu/ContextMenu.css';
import './components/common/UploadSuccessPopup.css';
import './components/common/NeighborsPopup.css';


export const NodeContext = React.createContext(null);

function App() {
  const [error, setError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false); // Renamed for clarity on what it blocks
  const [isUploading, setIsUploading] = useState(false);
  const [mapName, setMapName] = useState('My-Network-Map');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [contextMenu, setContextMenu] = useState(null);
  const [uploadSuccessData, setUploadSuccessData] = useState(null);
  const [neighborPopup, setNeighborPopup] = useState({ isOpen: false, neighbors: [], sourceNode: null });
  const [mapInteractionLoading, setMapInteractionLoading] = useState(false); // New state for loading during map interaction
  
  const { t } = useTranslation();
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  // --- Popup Handlers ---
  const handleShowNeighborPopup = useCallback((neighbors, sourceNode) => {
    setNeighborPopup({ isOpen: true, neighbors, sourceNode });
  }, []);

  const handleCloseNeighborPopup = useCallback(() => {
    setNeighborPopup(prev => ({ ...prev, isOpen: false }));
  }, []);

  // --- Custom Hooks for State and Logic Management ---
  const { theme, toggleTheme } = useThemeManager();
  useLocalizationManager();
  const { cactiGroups, selectedCactiGroupId, setSelectedCactiGroupId } = useCacti(setError, token);
  const {
    nodes, setNodes,
    edges, setEdges,
    selectedElements,
    snapLines,
    currentNeighbors, // Added currentNeighbors from hook
    onNodesChange,
    onNodeClick,
    onPaneClick,
    onSelectionChange,
    handleDeleteElements,
    handleUpdateNodeData,
    handleAddGroup,
    handleAddTextNode,
    createNodeObject,
    resetMap,
    undo,
    redo,
    alignElements,
    distributeElements,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    selectAllByType,
    confirmPreviewNode,
    confirmNeighbor,
    setLoading: setMapHookLoading, // Use setter from map hook
    setError: setMapHookError, // Use setter from map hook
  } = useMapInteraction(theme, handleShowNeighborPopup);

  // --- Memos and Derived State (Called Unconditionally) ---
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: GroupNode, text: TextNode }), []);
  const availableIcons = useMemo(() => Object.keys(ICONS_BY_THEME).filter(k => k !== 'Unknown'), []);

  const selectedCustomNode = useMemo(() => 
    selectedElements.length === 1 && selectedElements[0].type === 'custom' ? selectedElements[0] : null,
    [selectedElements]
  );

  const availableNeighbors = useMemo(() => {
      if (!selectedCustomNode) return [];

      // Get all existing connections for the selected node to check against.
      const existingConnections = new Set(
          edges
              .filter(e => e.source === selectedCustomNode.id || e.target === selectedCustomNode.id)
              .map(e => {
                  const targetNode = nodes.find(n => n.id === e.target);
                  // For end devices, create a unique key based on source, hostname, and interface.
                  if (targetNode && !targetNode.data.ip) {
                      return `${e.source}-${targetNode.data.hostname}-${e.data.interface}`;
                  }
                  // For regular devices, the IP is sufficient.
                  return e.target;
              })
      );

      return currentNeighbors.filter(n => {
          if (n.ip) {
              return !nodes.some(node => node.id === n.ip);
          }
          // For end devices, check if a connection with the same signature already exists.
          const connectionKey = `${selectedCustomNode.id}-${n.neighbor}-${n.interface}`;
          return !existingConnections.has(connectionKey);
      });
  }, [selectedCustomNode, currentNeighbors, nodes, edges]);


  // Sync the hook's loading/error states with App.js for global notifications
  const setIsLoading = useCallback((value) => {
      setMapInteractionLoading(value);
      setMapHookLoading(value);
  }, [setMapHookLoading]);

  const setAppError = useCallback((message) => {
      setError(message);
      setMapHookError(message);
      // Clear error after a delay
      if (message) {
          setTimeout(() => setError(''), 5000);
      }
  }, [setMapHookError]);

  // --- Keyboard Shortcuts for Undo/Redo ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z') {
          event.preventDefault();
          undo();
        } else if (event.key === 'y') {
          event.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);


  // --- Authentication Handlers ---
  const handleLogin = async (username, password) => {
    setIsAuthLoading(true);
    setAppError('');
    try {
      const response = await api.login(username, password);
      const newToken = response.data.token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
    } catch (err) {
      setAppError(t('app.errorLogin'));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    resetMap(); // Also clear the map on logout
  };

  const handleStart = async (ip, initialIconName) => {
    if (!ip) { setAppError(t('app.errorStartIp')); return; }
    
    setIsLoading(true); // This sets both App.js and the hook's loading state
    setAppError('');
    
    try {
      const response = await api.getInitialDevice(ip);
      const newNode = createNodeObject(response.data, { x: 400, y: 150 }, initialIconName);
      setNodes([newNode]);
      setEdges([]);
      // Simulate click to select the first node and fetch its neighbors
      // Pass the *full* set of App.js-scoped setters/helpers to onNodeClick
      onNodeClick(null, newNode, setIsLoading, setAppError); 
    } catch (err) {
      setAppError(t('app.errorInitialDevice'));
      resetMap();
      setIsLoading(false);
    }
  };

  const handleAddNeighborFromPopup = useCallback((neighborGroup) => {
    const { sourceNode } = neighborPopup;
    if (!sourceNode) return;
    
    confirmNeighbor(neighborGroup, sourceNode.id, setIsLoading, setAppError);

    // After adding, close the popup. The hook will manage updating neighbor availability.
    handleCloseNeighborPopup();
  }, [neighborPopup, confirmNeighbor, setIsLoading, setAppError, handleCloseNeighborPopup]);

  const handleAddAllNeighborsFromPopup = useCallback(async (neighborGroups) => {
    const { sourceNode } = neighborPopup;
    if (!sourceNode) return;

    handleCloseNeighborPopup();
    setIsLoading(true);

    // Process each neighbor sequentially to avoid race conditions
    for (const neighborGroup of neighborGroups) {
      await confirmNeighbor(neighborGroup, sourceNode.id, setIsLoading, setAppError);
    }
    
    setIsLoading(false);
  }, [neighborPopup, confirmNeighbor, setIsLoading, setAppError, handleCloseNeighborPopup]);


  const handleCreateMap = async () => {
    if (!reactFlowWrapper.current || nodes.length === 0) { setAppError(t('app.errorEmptyMap')); return; }
    if (!selectedCactiGroupId) { setAppError(t('app.errorSelectCacti')); return; }
    
    setIsUploading(true);
    setAppError('');
    
    try {
      const taskResponse = await handleUploadProcess({
        mapElement: reactFlowWrapper.current,
        nodes,
        edges,
        mapName,
        cactiGroupId: selectedCactiGroupId,
        theme,
        setNodes,
        setEdges
      });
      setUploadSuccessData(taskResponse);
      setMapName('My-Network-Map'); // Reset map name for the next creation
    } catch (err) {
      setAppError(t('app.errorUpload'));
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const onNodeClickHandler = useCallback((event, node) => {
      setContextMenu(null); // Close context menu on any node click
      // Pass the *full* set of App.js-scoped setters/helpers to onNodeClick
      onNodeClick(event, node, setIsLoading, setAppError); 
  }, [onNodeClick, setIsLoading, setAppError]);

  const onPaneClickHandler = useCallback(() => {
    onPaneClick();
    setContextMenu(null);
  }, [onPaneClick]);

  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    // Trigger selection logic before opening the menu
    // Pass the *full* set of App.js-scoped setters/helpers to onNodeClick
    onNodeClick(event, node, setIsLoading, setAppError, true);
    setContextMenu({ node, top: event.clientY, left: event.clientX });
  }, [onNodeClick, setIsLoading, setAppError]);

  if (!token) {
    return <LoginScreen onLogin={handleLogin} error={error} isLoading={isAuthLoading} />;
  }

  return (
    <NodeContext.Provider value={{ onUpdateNodeData: handleUpdateNodeData }}>
      <div className="app-container">
        <Sidebar 
          selectedElements={selectedElements}
          onUploadMap={handleCreateMap}
          onAddGroup={handleAddGroup}
          onAddTextNode={handleAddTextNode}
          onResetMap={resetMap}
          onLogout={handleLogout}
          availableIcons={availableIcons}
          mapName={mapName}
          setMapName={setMapName}
          isMapStarted={nodes.length > 0}
          isUploading={isUploading}
          cactiGroups={cactiGroups}
          selectedCactiGroupId={selectedCactiGroupId}
          setSelectedCactiGroupId={setSelectedCactiGroupId}
          selectAllByType={selectAllByType}
          onDeleteElements={handleDeleteElements}
          alignElements={alignElements}
          distributeElements={distributeElements}
          bringForward={bringForward}
          sendBackward={sendBackward}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          neighbors={availableNeighbors}
          onAddNeighbor={(neighbor) => {
            if (selectedCustomNode) {
              confirmNeighbor(neighbor, selectedCustomNode.id, setIsLoading, setAppError);
            }
          }}
        />
        <div className="main-content" ref={reactFlowWrapper}>
          <TopToolbar
            selectedElements={selectedElements}
            onUpdateNodeData={handleUpdateNodeData}
            alignElements={alignElements}
            distributeElements={distributeElements}
            availableIcons={availableIcons}
            theme={theme}
            toggleTheme={toggleTheme}
          />
          <div className='map-container'>
            {nodes.length === 0 ? (
              <div className="startup-wrapper">
                <StartupScreen 
                  onStart={handleStart} 
                  isLoading={isAuthLoading || mapInteractionLoading}
                  availableIcons={availableIcons}
                />
              </div>
            ) : (
              <ReactFlowProvider>
                <Map 
                  nodes={nodes} 
                  edges={edges} 
                  snapLines={snapLines} // Pass snapLines to the Map
                  onNodeClick={onNodeClickHandler} 
                  onNodesChange={onNodesChange}
                  onPaneClick={onPaneClickHandler}
                  onSelectionChange={onSelectionChange}
                  onNodeContextMenu={handleNodeContextMenu}
                  nodeTypes={nodeTypes} 
                  theme={theme}
                  setReactFlowInstance={(instance) => (reactFlowInstance.current = instance)}
                />
              </ReactFlowProvider>
            )}
            {contextMenu && (
              <ContextMenu
                node={contextMenu.node}
                top={contextMenu.top}
                left={contextMenu.left}
                onClose={() => setContextMenu(null)}
                onDeleteElements={handleDeleteElements}
                bringToFront={bringToFront}
                sendToBack={sendToBack}
                bringForward={bringForward}
                sendBackward={sendBackward}
              />
            )}
            {error && <p className="error-message">{error}</p>}
            {(isAuthLoading || isUploading || mapInteractionLoading) && (
              <p className="loading-message">
                {isUploading ? t('app.processingMap') : t('app.loading')}
              </p>
            )}
            <UploadSuccessPopup 
              key={uploadSuccessData ? JSON.stringify(uploadSuccessData.tasks) : 'popup-closed'}
              data={uploadSuccessData} 
              onClose={() => setUploadSuccessData(null)} 
            />
            <NeighborsPopup
              isOpen={neighborPopup.isOpen}
              neighbors={neighborPopup.neighbors}
              sourceHostname={neighborPopup.sourceNode?.data?.hostname}
              onAddNeighbor={handleAddNeighborFromPopup}
              onAddAllNeighbors={handleAddAllNeighborsFromPopup}
              onClose={handleCloseNeighborPopup}
            />
          </div>
        </div>
      </div>
    </NodeContext.Provider>
  );
}

export default App;