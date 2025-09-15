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

import * as api from './services/apiService';
import { handleUploadProcess } from './services/mapExportService';
import { ICONS_BY_THEME } from './config/constants';
import './App.css';
import './components/TopToolbar/TopToolbar.css';
import './components/ContextMenu/ContextMenu.css';

export const NodeContext = React.createContext(null);

function App() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mapName, setMapName] = useState('My-Network-Map');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [contextMenu, setContextMenu] = useState(null);
  
  const { t } = useTranslation();
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  // --- Custom Hooks for State and Logic Management ---
  const { theme, toggleTheme } = useThemeManager();
  useLocalizationManager();
  const { cactiInstallations, selectedCactiId, setSelectedCactiId } = useCacti(setError, token);
  const {
    nodes, setNodes,
    edges, setEdges,
    selectedElements,
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
  } = useMapInteraction(theme);

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
        } else if (event.key === 'a') {
          event.preventDefault();
          onSelectionChange({nodes: nodes.map(n => ({...n, selected: true})), edges: []});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, nodes, onSelectionChange]);


  // --- Authentication Handlers ---
  const handleLogin = async (username, password) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.login(username, password);
      const newToken = response.data.token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
    } catch (err) {
      setError(t('app.errorLogin'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    resetMap(); // Also clear the map on logout
  };

  // --- Memos for Performance ---
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: GroupNode, text: TextNode }), []);
  const availableIcons = useMemo(() => Object.keys(ICONS_BY_THEME).filter(k => k !== 'Unknown'), []);
  
  const handleStart = async (ip, initialIconName) => {
    if (!ip) { setError(t('app.errorStartIp')); return; }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await api.getInitialDevice(ip);
      const newNode = createNodeObject(response.data, { x: 400, y: 150 }, initialIconName);
      setNodes([newNode]);
      setEdges([]);
      // Simulate click to select the first node and fetch its neighbors
      onNodeClick(null, newNode, setIsLoading, setError);
    } catch (err) {
      setError(t('app.errorInitialDevice'));
      resetMap();
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

  const onNodeClickHandler = useCallback((event, node) => {
      setContextMenu(null); // Close context menu on any node click
      onNodeClick(event, node, setIsLoading, setError);
  }, [onNodeClick]);

  const onPaneClickHandler = useCallback(() => {
    onPaneClick();
    setContextMenu(null);
  }, [onPaneClick]);

  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    // Trigger selection logic before opening the menu
    onNodeClick(event, node, setIsLoading, setError, true);
    setContextMenu({ node, top: event.clientY, left: event.clientX });
  }, [onNodeClick]);

  if (!token) {
    return <LoginScreen onLogin={handleLogin} error={error} isLoading={isLoading} />;
  }

  return (
    <NodeContext.Provider value={{ onUpdateNodeData: handleUpdateNodeData }}>
      <div className="app-container">
        <Sidebar 
          selectedElements={selectedElements}
          onUploadMap={handleUploadMap}
          onAddGroup={handleAddGroup}
          onAddTextNode={handleAddTextNode}
          onResetMap={resetMap}
          onLogout={handleLogout}
          availableIcons={availableIcons}
          mapName={mapName}
          setMapName={setMapName}
          isMapStarted={nodes.length > 0}
          isUploading={isUploading}
          cactiInstallations={cactiInstallations}
          selectedCactiId={selectedCactiId}
          setSelectedCactiId={setSelectedCactiId}
          selectAllByType={selectAllByType}
          onDeleteElements={handleDeleteElements}
          alignElements={alignElements}
          distributeElements={distributeElements}
          bringForward={bringForward}
          sendBackward={sendBackward}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
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
                  isLoading={isLoading}
                  availableIcons={availableIcons}
                />
              </div>
            ) : (
              <ReactFlowProvider>
                <Map 
                  nodes={nodes} 
                  edges={edges} 
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
            {isLoading && !isUploading && <p className="loading-message">{t('app.loading')}</p>}
          </div>
        </div>
      </div>
    </NodeContext.Provider>
  );
}

export default App;