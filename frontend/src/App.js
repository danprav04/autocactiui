// frontend/src/App.js
import React, { useState, useCallback, useRef, useMemo } from 'react';
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
import StartupScreen from './components/Startup/StartupScreen';
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
  
  const { t } = useTranslation();
  const reactFlowWrapper = useRef(null);

  // --- Custom Hooks for State and Logic Management ---
  const { theme, toggleTheme } = useThemeManager();
  useLocalizationManager();
  const { cactiInstallations, selectedCactiId, setSelectedCactiId } = useCacti(setError);
  const {
    nodes, setNodes,
    edges, setEdges,
    selectedElement,
    neighbors,
    snapLines,
    onNodesChange,
    onNodeClick,
    onPaneClick,
    handleAddNeighbor,
    handleDeleteNode,
    handleUpdateNodeData,
    handleAddGroup,
    createNodeObject,
    resetMap,
  } = useMapInteraction(theme);

  // --- Memos for Performance ---
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: GroupNode }), []);
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
      onNodeClick(event, node, setIsLoading, setError);
  }, [onNodeClick]);

  const onAddNeighborHandler = useCallback(async (neighbor) => {
      await handleAddNeighbor(neighbor, setIsLoading, setError);
  }, [handleAddNeighbor]);

  return (
    <NodeContext.Provider value={{ onUpdateNodeData: handleUpdateNodeData }}>
      <div className="app-container">
        <Sidebar 
          selectedElement={selectedElement}
          neighbors={neighbors}
          onAddNeighbor={onAddNeighborHandler}
          onDeleteNode={handleDeleteNode}
          onUpdateNodeData={handleUpdateNodeData}
          onUploadMap={handleUploadMap}
          onAddGroup={handleAddGroup}
          onResetMap={resetMap}
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
                nodeTypes={nodeTypes} 
                theme={theme}
                snapLines={snapLines}
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