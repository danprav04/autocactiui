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
import ThemeToggleButton from './components/common/ThemeToggleButton';
import LanguageSwitcher from './components/common/LanguageSwitcher';

import * as api from './services/apiService';
import { handleUploadProcess } from './services/mapExportService';
import { ICONS_BY_THEME } from './config/constants';
import './App.css';

export const NodeContext = React.createContext(null);

function App() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mapName, setMapName] = useState('My-Network-Map');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  
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
    neighbors,
    onNodesChange,
    onNodeClick,
    onPaneClick,
    onSelectionChange,
    handleAddNeighbor,
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
  } = useMapInteraction(theme, reactFlowInstance);

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
      onNodeClick(null, newNode, setIsLoading, setError, false);
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
      const isMultiSelect = event.ctrlKey || event.metaKey;
      onNodeClick(event, node, setIsLoading, setError, isMultiSelect);
  }, [onNodeClick]);

  const onAddNeighborHandler = useCallback(async (neighbor) => {
      await handleAddNeighbor(neighbor, setIsLoading, setError);
  }, [handleAddNeighbor]);

  if (!token) {
    return <LoginScreen onLogin={handleLogin} error={error} isLoading={isLoading} />;
  }

  return (
    <NodeContext.Provider value={{ onUpdateNodeData: handleUpdateNodeData }}>
      <div className="app-container">
        <Sidebar 
          selectedElements={selectedElements}
          neighbors={neighbors}
          onAddNeighbor={onAddNeighborHandler}
          onDeleteElements={handleDeleteElements}
          onUpdateNodeData={handleUpdateNodeData}
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
          alignElements={alignElements}
          distributeElements={distributeElements}
          bringForward={bringForward}
          sendBackward={sendBackward}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          selectAllByType={selectAllByType}
        />
        <div className="main-content" ref={reactFlowWrapper}>
          <div className="top-controls">
            <LanguageSwitcher />
            <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
          </div>
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
                onPaneClick={onPaneClick}
                onSelectionChange={onSelectionChange}
                nodeTypes={nodeTypes} 
                theme={theme}
                setReactFlowInstance={(instance) => (reactFlowInstance.current = instance)}
              />
            </ReactFlowProvider>
          )}
          {error && <p className="error-message">{error}</p>}
          {isLoading && !isUploading && <p className="loading-message">{t('app.loading')}</p>}
        </div>
      </div>
    </NodeContext.Provider>
  );
}

export default App;