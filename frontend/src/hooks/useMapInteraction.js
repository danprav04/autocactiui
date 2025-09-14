// frontend/src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';
import { useHistoryState } from './useHistoryState';
import { useNodeManagement } from './useNodeManagement';
import { useTooling } from './useTooling';

export const useMapInteraction = (theme) => {
  const { state, setState, undo, redo, resetState } = useHistoryState();
  // Defensive fallback to prevent crash if state is ever undefined during a rapid re-render
  const { nodes, edges } = state || { nodes: [], edges: [] };

  const [selectedElements, setSelectedElements] = useState([]);
  const [neighbors, setNeighbors] = useState([]);
  const { t } = useTranslation();

  const {
    createNodeObject,
    handleDeleteElements,
    handleUpdateNodeData,
    handleAddGroup,
    handleAddTextNode,
  } = useNodeManagement(theme, setState);

  const {
    alignElements,
    distributeElements,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    selectAllByType,
  } = useTooling(selectedElements, setState);

  // Update icons when theme changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => {
        if (node.type !== 'custom') return node;
        const iconType = node.data.iconType;
        if (iconType && ICONS_BY_THEME[iconType]) {
          return { ...node, data: { ...node.data, icon: ICONS_BY_THEME[iconType][theme] } };
        }
        return node;
      })
    }), true); // Overwrite state, no history change for theme
  }, [theme, setState]);
  
  const updateSelection = useCallback((newSelectedNodes) => {
    setSelectedElements(newSelectedNodes);
    const selectedIds = new Set(newSelectedNodes.map(n => n.id));
    setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({ ...n, selected: selectedIds.has(n.id) }))
    }), true);
  }, [setState]);

  const onNodesChange = useCallback((changes) => {
    const positionChange = changes.find((change) => change.type === 'position' && change.position);
    
    if (positionChange) {
        const isDragEnd = !positionChange.dragging;
        setState(prev => {
            const newNodes = prev.nodes.map((node) => {
                if (node.id === positionChange.id) {
                    const absolutePosition = positionChange.position;
                    let newParent = null;
                    if (isDragEnd) {
                        for (const group of prev.nodes.filter(g => g.type === 'group' && g.id !== node.id)) {
                            const nodeCenter = { x: absolutePosition.x + (node.width||NODE_WIDTH)/2, y: absolutePosition.y + (node.height||NODE_HEIGHT)/2 };
                            if (nodeCenter.x > group.position.x && nodeCenter.x < group.position.x + group.data.width &&
                                nodeCenter.y > group.position.y && nodeCenter.y < group.position.y + group.data.height) {
                                newParent = group;
                                break;
                            }
                        }
                    } else {
                        newParent = prev.nodes.find(n => n.id === node.parentNode);
                    }
                    if (newParent) {
                        return { ...node, position: { x: absolutePosition.x - newParent.position.x, y: absolutePosition.y - newParent.position.y }, parentNode: newParent.id, extent: 'parent' };
                    }
                    const { parentNode, extent, ...rest } = node;
                    return { ...rest, position: absolutePosition };
                }
                return node;
            });
            return { ...prev, nodes: newNodes };
        }, !isDragEnd);
    } else {
        setState(prev => ({ ...prev, nodes: applyNodeChanges(changes, prev.nodes) }));
    }
  }, [setState]);

  const handleFetchNeighbors = useCallback(async (ip, setLoading, setError) => {
    setLoading(true); setError('');
    try {
      const response = await api.getDeviceNeighbors(ip);
      setState(prev => {
          if (!prev) return; // Defensive check
          const allNeighbors = response.data.neighbors;
          const nodeIdsOnMap = new Set(prev.nodes.map(n => n.id));
          setNeighbors(allNeighbors.filter(n => !nodeIdsOnMap.has(n.ip)));

          const currentEdgeIds = new Set(prev.edges.map(e => e.id));
          const edgesToCreate = allNeighbors
            .filter(n => nodeIdsOnMap.has(n.ip))
            .filter(n => !currentEdgeIds.has(`e-${ip}-${n.ip}`) && !currentEdgeIds.has(`e-${n.ip}-${ip}`))
            .map(n => ({ id: `e-${ip}-${n.ip}`, source: ip, target: n.ip, animated: true, style: { stroke: '#6c757d' }, data: { interface: n.interface } }));
          
          return edgesToCreate.length > 0 ? { ...prev, edges: [...prev.edges, ...edgesToCreate] } : prev;
      });
    } catch (err) {
      setError(t('app.errorFetchNeighbors', { ip }));
      setNeighbors([]);
    } finally {
      setLoading(false);
    }
  }, [setState, t]);

  const onNodeClick = useCallback((event, node, setLoading, setError, isMultiSelect) => {
    let newSelectedNodes;
    if (isMultiSelect) {
        newSelectedNodes = selectedElements.some(el => el.id === node.id)
            ? selectedElements.filter(el => el.id !== node.id)
            : [...selectedElements, node];
    } else {
        if (selectedElements.length === 1 && selectedElements[0].id === node.id) {
            if (neighbors.length === 0 && node.type === 'custom') handleFetchNeighbors(node.id, setLoading, setError);
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

  const onPaneClick = useCallback(() => { updateSelection([]); setNeighbors([]); }, [updateSelection]);
  const onSelectionChange = useCallback(({ nodes }) => updateSelection(nodes), [updateSelection]);

  const handleAddNeighbor = useCallback(async (neighbor, setLoading, setError) => {
    const sourceNode = selectedElements.length === 1 ? selectedElements[0] : null;
    if (!sourceNode || sourceNode.type !== 'custom' || (nodes && nodes.some(n => n.id === neighbor.ip))) return;
    
    setLoading(true); setError('');
    try {
      const deviceResponse = await api.getDeviceInfo(neighbor.ip);
      if (!deviceResponse.data || deviceResponse.data.error) throw new Error(`No info for ${neighbor.ip}`);
      
      const newNode = createNodeObject(deviceResponse.data, { x: sourceNode.position.x + 200, y: sourceNode.position.y });
      const newEdge = { id: `e-${sourceNode.id}-${newNode.id}`, source: sourceNode.id, target: newNode.id, animated: true, style: { stroke: '#6c757d' }, data: { interface: neighbor.interface } };
      
      const newDeviceNeighbors = (await api.getDeviceNeighbors(newNode.id)).data.neighbors;
      
      setState(prev => {
          if (!prev) return; // Defensive check
          const nextNodes = [...prev.nodes, newNode];
          const nextEdges = [...prev.edges, newEdge];
          const nodeIds = new Set(nextNodes.map(n => n.id));
          const edgeIds = new Set(nextEdges.map(e => e.id));
          
          const interconnects = newDeviceNeighbors
              .filter(n => nodeIds.has(n.ip))
              .filter(n => !edgeIds.has(`e-${newNode.id}-${n.ip}`) && !edgeIds.has(`e-${n.ip}-${newNode.id}`))
              .map(n => ({ id: `e-${newNode.id}-${n.ip}`, source: newNode.id, target: n.ip, animated: true, style: { stroke: '#6c757d' }, data: { interface: n.interface } }));

          return { nodes: nextNodes, edges: [...nextEdges, ...interconnects] };
      });
      setNeighbors(prev => prev.filter(n => n.ip !== neighbor.ip));
    } catch (err) {
      setError(t('app.errorAddNeighbor', {ip: neighbor.ip}));
    } finally {
      setLoading(false);
    }
  }, [selectedElements, nodes, createNodeObject, setState, t]);

  const resetMap = useCallback(() => {
    resetState();
    setSelectedElements([]);
    setNeighbors([]);
  }, [resetState]);
  
  // Expose a function that needs `updateSelection`
  const selectAllByTypeHandler = useCallback((iconType) => {
    selectAllByType(iconType, updateSelection);
  }, [selectAllByType, updateSelection]);

  return {
    nodes, setNodes: (newNodes) => setState(prev => ({...prev, nodes: typeof newNodes === 'function' ? newNodes(prev.nodes) : newNodes}), true),
    edges, setEdges: (newEdges) => setState(prev => ({...prev, edges: typeof newEdges === 'function' ? newEdges(prev.edges) : newEdges}), true),
    selectedElements,
    neighbors,
    onNodesChange,
    onNodeClick,
    onPaneClick,
    onSelectionChange,
    handleAddNeighbor,
    handleDeleteElements: () => handleDeleteElements(selectedElements),
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
    selectAllByType: selectAllByTypeHandler,
  };
};