// frontend/src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

const getInitialState = () => {
  try {
    const savedNodes = localStorage.getItem('mapNodes');
    const savedEdges = localStorage.getItem('mapEdges');
    return {
      nodes: savedNodes ? JSON.parse(savedNodes) : [],
      edges: savedEdges ? JSON.parse(savedEdges) : [],
    };
  } catch (error) {
    console.error("Failed to parse map state from localStorage", error);
    return { nodes: [], edges: [] };
  }
};

export const useMapInteraction = (theme, reactFlowInstanceRef) => {
  const initialState = getInitialState();
  const [nodes, setNodes] = useState(initialState.nodes);
  const [edges, setEdges] = useState(initialState.edges);
  
  const [history, setHistory] = useState([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedElements, setSelectedElements] = useState([]);
  const [neighbors, setNeighbors] = useState([]);
  const { t } = useTranslation();

  useEffect(() => {
    const currentState = history[historyIndex];
    if (currentState) {
      localStorage.setItem('mapNodes', JSON.stringify(currentState.nodes));
      localStorage.setItem('mapEdges', JSON.stringify(currentState.edges));
    }
  }, [history, historyIndex]);

  useEffect(() => {
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
  }, [theme, setNodes]);
  
  const recordChange = useCallback((newNodes, newEdges) => {
      const newHistory = history.slice(0, historyIndex + 1);
      setHistory([...newHistory, { nodes: newNodes, edges: newEdges }]);
      setHistoryIndex(newHistory.length);
      setNodes(newNodes);
      setEdges(newEdges);
  }, [history, historyIndex]);
  
  const undo = useCallback(() => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          const prevState = history[newIndex];
          setNodes(prevState.nodes);
          setEdges(prevState.edges);
      }
  }, [history, historyIndex]);
  
  const redo = useCallback(() => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          const nextState = history[newIndex];
          setNodes(nextState.nodes);
          setEdges(nextState.edges);
      }
  }, [history, historyIndex]);


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
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      zIndex: 10
    };
  }, [theme]);

  const onNodesChange = useCallback((changes) => {
    const updatedNodes = applyNodeChanges(changes, nodes);
    
    const dragEndChange = changes.find(change => change.type === 'position' && !change.dragging);
    if (dragEndChange) {
        const movedNode = updatedNodes.find(n => n.id === dragEndChange.id);
        if (movedNode) {
            const groupNodes = updatedNodes.filter(n => n.type === 'group' && n.id !== movedNode.id);
            let parentGroup = null;

            for (const group of groupNodes) {
                const nodeCenter = { x: movedNode.position.x + movedNode.width / 2, y: movedNode.position.y + movedNode.height / 2 };
                if (
                    nodeCenter.x > group.position.x && nodeCenter.x < group.position.x + group.data.width &&
                    nodeCenter.y > group.position.y && nodeCenter.y < group.position.y + group.data.height
                ) {
                    parentGroup = group;
                    break;
                }
            }

            if (parentGroup) {
                movedNode.parentNode = parentGroup.id;
                movedNode.extent = 'parent';
                movedNode.position = {
                    x: movedNode.position.x - parentGroup.position.x,
                    y: movedNode.position.y - parentGroup.position.y,
                };
            } else {
                if (movedNode.parentNode) {
                   const oldParent = nodes.find(n => n.id === movedNode.parentNode);
                   if (oldParent) {
                       movedNode.position = {
                           x: movedNode.position.x + oldParent.position.x,
                           y: movedNode.position.y + oldParent.position.y,
                       };
                   }
                }
                delete movedNode.parentNode;
                delete movedNode.extent;
            }
        }
    }
    
    if (changes.some(c => c.type === 'position' && !c.dragging)) {
        recordChange(updatedNodes, edges);
    } else {
        setNodes(updatedNodes);
    }
  }, [nodes, edges, recordChange]);

  const updateSelection = useCallback((newSelectedNodes) => {
    setSelectedElements(newSelectedNodes);
    const selectedIds = new Set(newSelectedNodes.map(n => n.id));
    setNodes(nds => nds.map(n => ({ ...n, selected: selectedIds.has(n.id) })));
  }, [setNodes]);

  const handleFetchNeighbors = useCallback(async (ip, setLoading, setError) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getDeviceNeighbors(ip);
      setNeighbors(response.data.neighbors.filter(n => !nodes.some(node => node.id === n.ip)));
    } catch (err) {
      setError(t('app.errorFetchNeighbors', { ip }));
      setNeighbors([]);
    } finally {
      setLoading(false);
    }
  }, [nodes, t]);

  const onNodeClick = useCallback((event, node, setLoading, setError, isMultiSelect) => {
    let newSelectedNodes;
    if (isMultiSelect) {
        const alreadySelected = selectedElements.some(el => el.id === node.id);
        if (alreadySelected) {
            newSelectedNodes = selectedElements.filter(el => el.id !== node.id);
        } else {
            newSelectedNodes = [...selectedElements, node];
        }
    } else {
        if (selectedElements.length === 1 && selectedElements[0].id === node.id) {
            if(neighbors.length === 0 && node.type === 'custom') {
                 handleFetchNeighbors(node.id, setLoading, setError);
            }
            return;
        }
        newSelectedNodes = [node];
    }

    updateSelection(newSelectedNodes);

    if (newSelectedNodes.length === 1 && newSelectedNodes[0].type === 'custom') {
        handleFetchNeighbors(newSelectedNodes[0].id, setLoading, setError);
    } else {
        setNeighbors([]);
    }
  }, [selectedElements, updateSelection, handleFetchNeighbors, neighbors.length]);

  const onPaneClick = useCallback(() => {
    updateSelection([]);
    setNeighbors([]);
  }, [updateSelection]);
  
  const onSelectionChange = useCallback(({ nodes: selectedNodesFromRF }) => {
      updateSelection(selectedNodesFromRF);
  }, [updateSelection]);

  const handleAddNeighbor = useCallback(async (neighbor, setLoading, setError) => {
    const singleSelected = selectedElements.length === 1 ? selectedElements[0] : null;
    if (!singleSelected || singleSelected.type !== 'custom' || nodes.some(n => n.id === neighbor.ip)) return;
    
    setLoading(true);
    setError('');
    try {
      const deviceResponse = await api.getDeviceInfo(neighbor.ip);
      if (!deviceResponse.data || deviceResponse.data.error) throw new Error(`No info for ${neighbor.ip}`);
      
      const newPosition = { x: singleSelected.position.x + (Math.random() * 250 - 125), y: singleSelected.position.y + 150 };
      const newNode = createNodeObject(deviceResponse.data, newPosition);

      const primaryEdge = {
          id: `e-${singleSelected.id}-${newNode.id}`,
          source: singleSelected.id,
          target: newNode.id,
          animated: true,
          style: { stroke: '#6c757d' },
          data: { interface: neighbor.interface }
      };
      
      recordChange([...nodes, newNode], [...edges, primaryEdge]);
      setNeighbors(prev => prev.filter(n => n.ip !== neighbor.ip));
    } catch(err) {
        setError(t('app.errorAddNeighbor', {ip: neighbor.ip}));
    } finally {
        setLoading(false);
    }
  }, [createNodeObject, selectedElements, nodes, edges, t, recordChange]);

  const handleDeleteElements = useCallback(() => {
    if (selectedElements.length === 0) return;
    const selectedIds = new Set(selectedElements.map(el => el.id));

    const newNodes = nodes.filter(n => !selectedIds.has(n.id));
    const newEdges = edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    
    recordChange(newNodes, newEdges);
    updateSelection([]);
    setNeighbors([]);
  }, [selectedElements, nodes, edges, recordChange, updateSelection]);

  const handleUpdateNodeData = useCallback((nodeId, updatedData, addToHistory = true) => {
    const newNodes = nodes.map(n => {
      if (n.id === nodeId) {
        let finalData = { ...n.data, ...updatedData };
        if (n.type === 'custom') {
            const newIconType = updatedData.iconType || n.data.iconType;
            finalData.icon = ICONS_BY_THEME[newIconType][theme];
        }
        return { ...n, data: finalData };
      }
      return n;
    });

    if (addToHistory) {
      recordChange(newNodes, edges);
    } else {
      setNodes(newNodes);
    }
  }, [theme, nodes, edges, recordChange]);

  const handleAddGroup = useCallback(() => {
    const newGroup = {
      id: `group_${Date.now()}`,
      type: 'group',
      position: { x: 200, y: 200 },
      data: {
        label: t('sidebar.newGroupName'),
        color: '#cfe2ff', width: 400, height: 300, opacity: 0.6,
        shape: 'rounded-rectangle',
        borderColor: '#8a8d91', borderStyle: 'dashed', borderWidth: 1,
      },
      zIndex: 0
    };
    recordChange([...nodes, newGroup], edges);
  }, [t, nodes, edges, recordChange]);
  
  const handleAddTextNode = useCallback(() => {
      const newNode = {
          id: `text_${Date.now()}`,
          type: 'text',
          position: {x: 300, y: 100},
          data: {
              text: 'New Text',
              fontSize: 16,
              color: theme === 'dark' ? '#e4e6eb' : '#212529'
          },
          zIndex: 10
      };
      recordChange([...nodes, newNode], edges);
  }, [nodes, edges, recordChange, theme]);
  
  const alignElements = useCallback((direction) => {
      if (selectedElements.length < 2) return;
      
      const updatedNodes = [...nodes];
      const selectedIds = selectedElements.map(el => el.id);

      let anchor;
      switch (direction) {
          case 'left':
              anchor = Math.min(...selectedElements.map(el => el.position.x));
              break;
          case 'right':
              anchor = Math.max(...selectedElements.map(el => el.position.x + (el.width || NODE_WIDTH)));
              break;
          case 'top':
              anchor = Math.min(...selectedElements.map(el => el.position.y));
              break;
          case 'bottom':
              anchor = Math.max(...selectedElements.map(el => el.position.y + (el.height || NODE_HEIGHT)));
              break;
          case 'h-center':
              anchor = selectedElements.reduce((sum, el) => sum + el.position.x + (el.width || NODE_WIDTH) / 2, 0) / selectedElements.length;
              break;
          case 'v-center':
              anchor = selectedElements.reduce((sum, el) => sum + el.position.y + (el.height || NODE_HEIGHT) / 2, 0) / selectedElements.length;
              break;
          default: return;
      }

      const newNodes = updatedNodes.map(node => {
          if (!selectedIds.includes(node.id)) return node;
          const newPos = { ...node.position };
          const width = node.width || NODE_WIDTH;
          const height = node.height || NODE_HEIGHT;
          
          if (direction === 'left') newPos.x = anchor;
          if (direction === 'right') newPos.x = anchor - width;
          if (direction === 'top') newPos.y = anchor;
          if (direction === 'bottom') newPos.y = anchor - height;
          if (direction === 'h-center') newPos.x = anchor - width / 2;
          if (direction === 'v-center') newPos.y = anchor - height / 2;
          
          return { ...node, position: newPos };
      });
      recordChange(newNodes, edges);
  }, [selectedElements, nodes, edges, recordChange]);

  const distributeElements = useCallback((direction) => {
      if (selectedElements.length < 3) return;

      const sorted = [...selectedElements].sort((a, b) => 
          direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
      );

      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      
      let totalSpace, totalSize, startPos, endPos;
      if (direction === 'horizontal') {
          startPos = first.position.x;
          endPos = last.position.x;
          totalSpace = endPos - startPos;
          totalSize = sorted.reduce((sum, el) => sum + (el.width || NODE_WIDTH), 0);
      } else {
          startPos = first.position.y;
          endPos = last.position.y;
          totalSpace = endPos - startPos;
          totalSize = sorted.reduce((sum, el) => sum + (el.height || NODE_HEIGHT), 0);
      }

      const spacing = (totalSpace - totalSize) / (sorted.length - 1);
      let currentPos = startPos + (sorted[0].width || NODE_WIDTH) + spacing;
      
      const newNodes = nodes.map(node => {
          const sortedIndex = sorted.findIndex(s => s.id === node.id);
          if (sortedIndex === -1 || sortedIndex === 0 || sortedIndex === sorted.length -1) return node;

          const el = sorted[sortedIndex];
          const newPos = { ...el.position };

          if (direction === 'horizontal') {
              newPos.x = currentPos;
              currentPos += (el.width || NODE_WIDTH) + spacing;
          } else {
              newPos.y = currentPos;
              currentPos += (el.height || NODE_HEIGHT) + spacing;
          }
          return { ...node, position: newPos };
      });
      recordChange(newNodes, edges);
  }, [selectedElements, nodes, edges, recordChange]);

  const changeZIndex = useCallback((direction) => {
      if (selectedElements.length === 0) return;
      
      const zIndexes = nodes.map(n => n.zIndex || 0);
      const minZ = Math.min(...zIndexes);
      const maxZ = Math.max(...zIndexes);
      const selectedIds = new Set(selectedElements.map(el => el.id));

      const newNodes = nodes.map(node => {
          if (!selectedIds.has(node.id)) return node;
          
          const currentZ = node.zIndex || 0;
          let newZ = currentZ;
          
          switch(direction) {
              case 'front': newZ = maxZ + 1; break;
              case 'back': newZ = minZ - 1; break;
              case 'forward': newZ = currentZ + 1; break;
              case 'backward': newZ = currentZ - 1; break;
              default: break;
          }
          return { ...node, zIndex: newZ };
      });
      recordChange(newNodes, edges);
  }, [selectedElements, nodes, edges, recordChange]);

  const selectAllByType = useCallback((iconType) => {
    const selected = nodes.filter(n => n.data.iconType === iconType);
    updateSelection(selected);
  }, [nodes, updateSelection]);

  const resetMap = () => {
    const initialState = { nodes: [], edges: [] };
    setNodes(initialState.nodes);
    setEdges(initialState.edges);
    setSelectedElements([]);
    setNeighbors([]);
    setHistory([initialState]);
    setHistoryIndex(0);
    localStorage.removeItem('mapNodes');
    localStorage.removeItem('mapEdges');
  };

  return {
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
    bringForward: () => changeZIndex('forward'),
    sendBackward: () => changeZIndex('backward'),
    bringToFront: () => changeZIndex('front'),
    sendToBack: () => changeZIndex('back'),
    selectAllByType,
  };
};