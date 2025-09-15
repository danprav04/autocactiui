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
  const [currentNeighbors, setCurrentNeighbors] = useState([]);
  const { t } = useTranslation();

  const {
    createNodeObject,
    handleDeleteElements: baseHandleDeleteElements,
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
  
  // Helper to remove temporary preview nodes and edges
  const clearPreviewElements = useCallback(() => {
      setState(prev => {
          if (!prev) return;
          const nextNodes = prev.nodes.filter(n => !n.data.isPreview);
          const nextEdges = prev.edges.filter(e => !e.data.isPreview);
          // Only update state if there were changes
          if (nextNodes.length < prev.nodes.length || nextEdges.length < prev.edges.length) {
              return { nodes: nextNodes, edges: nextEdges };
          }
          return prev;
      }, true); // Overwrite state, no history for this cleanup
  }, [setState]);

  const handleFetchNeighbors = useCallback(async (sourceNode, setLoading, setError) => {
    setLoading(true); setError('');
    setCurrentNeighbors([]);
    try {
      const response = await api.getDeviceNeighbors(sourceNode.id);
      const allNeighbors = response.data.neighbors;

      setState(prev => {
        if (!prev) return prev;
        // First, clear any existing preview elements from a previous selection
        const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview);
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
        
        const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));
        const neighborsToAdd = allNeighbors.filter(n => !nodeIdsOnMap.has(n.ip));

        setCurrentNeighbors(neighborsToAdd);

        // Auto-draw edges to existing nodes, regardless of whether there are new neighbors
        const currentEdgeIds = new Set(edgesWithoutPreviews.map(e => e.id));
        const edgesToCreate = allNeighbors
            .filter(n => nodeIdsOnMap.has(n.ip))
            .filter(n => !currentEdgeIds.has(`e-${sourceNode.id}-${n.ip}`) && !currentEdgeIds.has(`e-${n.ip}-${sourceNode.id}`))
            .map(n => ({ id: `e-${sourceNode.id}-${n.ip}`, source: sourceNode.id, target: n.ip, animated: true, style: { stroke: '#6c757d' }, data: { interface: n.interface } }));
        
        const edgesWithNewConnections = [...edgesWithoutPreviews, ...edgesToCreate];

        if (neighborsToAdd.length === 0) {
            return { nodes: nodesWithoutPreviews, edges: edgesWithNewConnections };
        }
        
        const previewNodes = [];
        const previewEdges = [];
        const radius = 250;
        const angleStep = (2 * Math.PI) / neighborsToAdd.length;

        neighborsToAdd.forEach((neighbor, index) => {
            const angle = angleStep * index - (Math.PI / 2); // Start from top
            const position = {
                x: sourceNode.position.x + radius * Math.cos(angle),
                y: sourceNode.position.y + radius * Math.sin(angle)
            };
            
            const previewNode = createNodeObject(
                { ip: neighbor.ip, hostname: neighbor.neighbor, type: 'Unknown' }, // Mock device info for preview
                position
            );
            previewNode.data.isPreview = true;
            previewNodes.push(previewNode);

            previewEdges.push({
                id: `e-${sourceNode.id}-${neighbor.ip}`,
                source: sourceNode.id,
                target: neighbor.ip,
                style: { stroke: '#007bff', strokeDasharray: '5 5' },
                data: { isPreview: true, interface: neighbor.interface }
            });
        });
        
        return { nodes: [...nodesWithoutPreviews, ...previewNodes], edges: [...edgesWithNewConnections, ...previewEdges] };
      });
    } catch (err) {
      setError(t('app.errorFetchNeighbors', { ip: sourceNode.id }));
    } finally {
      setLoading(false);
    }
  }, [setState, createNodeObject, t]);

  const confirmPreviewNode = useCallback(async (nodeToConfirm, setLoading, setError) => {
    setLoading(true); setError('');
    setCurrentNeighbors([]);
    try {
        const deviceResponse = await api.getDeviceInfo(nodeToConfirm.id);
        if (deviceResponse.data.error) throw new Error(`No info for ${nodeToConfirm.id}`);
        
        const confirmedNodeData = deviceResponse.data;
        let confirmedNodeForFetch = null;

        setState(prev => {
            const otherPreviewNodeIds = new Set(prev.nodes.filter(n => n.data.isPreview && n.id !== nodeToConfirm.id).map(n => n.id));

            const finalNodes = prev.nodes
                .filter(n => !otherPreviewNodeIds.has(n.id))
                .map(n => {
                    if (n.id === nodeToConfirm.id) {
                        const updatedNode = createNodeObject(confirmedNodeData, n.position);
                        updatedNode.selected = true; // Select the new node
                        confirmedNodeForFetch = updatedNode; // Store for fetching neighbors later
                        return updatedNode;
                    }
                    return {...n, selected: false}; // Deselect all other nodes
                });
            
            const finalEdges = prev.edges
                .filter(e => !e.data.isPreview || e.target === nodeToConfirm.id)
                .map(e => {
                    if (e.target === nodeToConfirm.id) {
                        return { ...e, style: { stroke: '#6c757d' }, data: { ...e.data, isPreview: false }, animated: true };
                    }
                    return e;
                });
            
            return { nodes: finalNodes, edges: finalEdges };
        });

        // After state has updated, fetch neighbors for the newly confirmed node
        if (confirmedNodeForFetch) {
            handleFetchNeighbors(confirmedNodeForFetch, setLoading, setError);
        }

    } catch (err) {
        setError(t('app.errorAddNeighbor', { ip: nodeToConfirm.id }));
        clearPreviewElements(); // Clear previews on error
    } finally {
        setLoading(false);
    }
  }, [setState, createNodeObject, handleFetchNeighbors, clearPreviewElements, t]);

  const confirmNeighbor = useCallback((neighbor, setLoading, setError) => {
      const nodeToConfirm = nodes.find(n => n.id === neighbor.ip && n.data.isPreview);
      if (nodeToConfirm) {
          confirmPreviewNode(nodeToConfirm, setLoading, setError);
      }
  }, [nodes, confirmPreviewNode]);

  const onNodeClick = useCallback((event, node, setLoading, setError, isContextMenu = false) => {
    // If a preview node is clicked, confirm it and stop further processing.
    if (node.data.isPreview) {
        confirmPreviewNode(node, setLoading, setError);
        return;
    }
    
    const isNodeAlreadySelected = selectedElements.some(el => el.id === node.id);

    // If it's a context menu click on an already selected node, do nothing to the selection.
    if (isContextMenu && isNodeAlreadySelected) {
        return;
    }

    const isMultiSelect = event && (event.ctrlKey || event.metaKey);
    let newSelectedNodes;

    if (isMultiSelect) {
        newSelectedNodes = isNodeAlreadySelected
            ? selectedElements.filter(el => el.id !== node.id)
            : [...selectedElements, node];
    } else {
        // This case now handles:
        // - Plain left-click (always re-selects)
        // - Context menu on a new node (selects it)
        newSelectedNodes = [node];
    }

    // Update selection state and clear any old previews
    setSelectedElements(newSelectedNodes);
    clearPreviewElements();

    setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({...n, selected: newSelectedNodes.some(sn => sn.id === n.id)}))
    }), true);

    // If a single device is now selected, fetch its neighbors to show as previews.
    if (newSelectedNodes.length === 1 && newSelectedNodes[0].type === 'custom') {
        handleFetchNeighbors(newSelectedNodes[0], setLoading, setError);
    } else {
        setCurrentNeighbors([]);
    }
  }, [selectedElements, setState, clearPreviewElements, handleFetchNeighbors, confirmPreviewNode]);

  const onPaneClick = useCallback(() => {
    setSelectedElements([]);
    setCurrentNeighbors([]);
    clearPreviewElements();
    setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({...n, selected: false}))
    }), true);
  }, [setState, clearPreviewElements]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
      setSelectedElements(selectedNodes);
      // Clear preview elements if the selection is not a single device node.
      if (selectedNodes.length !== 1 || (selectedNodes.length === 1 && selectedNodes[0].type !== 'custom')) {
          clearPreviewElements();
          setCurrentNeighbors([]);
      }
  }, [clearPreviewElements]);
  
  const handleDeleteElements = useCallback(() => {
    baseHandleDeleteElements(selectedElements);
    setSelectedElements([]); // Clear local selection state after deletion
  }, [baseHandleDeleteElements, selectedElements]);

  const onNodesChange = useCallback((changes) => {
    const dragChange = changes.find(c => c.type === 'position');
    const isDragStart = dragChange && dragChange.dragging === true;
    const isDragEnd = dragChange && dragChange.dragging === false;

    setState(prev => {
        // --- HANDLE DRAG START: Pop the node out of its group ---
        if (isDragStart) {
            const draggedNodeId = dragChange.id;
            const originalNode = prev.nodes.find(n => n.id === draggedNodeId);

            // Check if this is the very first drag event for a child node.
            if (originalNode && originalNode.parentNode) {
                const parentNode = prev.nodes.find(n => n.id === originalNode.parentNode);
                
                let nodesForChange = prev.nodes;
                if (parentNode) {
                    // Create a new nodes array where the dragged node is "un-parented"
                    // and its position is converted to absolute coordinates.
                    nodesForChange = prev.nodes.map(n => {
                        if (n.id === draggedNodeId) {
                            const { parentNode: _, extent: __, ...rest } = n;
                            return {
                                ...rest,
                                position: {
                                    x: parentNode.position.x + n.position.x,
                                    y: parentNode.position.y + n.position.y,
                                }
                            };
                        }
                        return n;
                    });
                }
                
                // Apply the current drag movement to this modified node structure.
                const nodesAfterMove = applyNodeChanges(changes, nodesForChange);
                return { ...prev, nodes: nodesAfterMove };
            }
        }
        
        // For regular moves or subsequent drag events, just apply the changes.
        const nodesAfterMove = applyNodeChanges(changes, prev.nodes);

        // --- HANDLE DRAG END: Find a new parent for the dropped node ---
        if (isDragEnd) {
            const draggedNodeIds = new Set(changes.filter(c => c.type === 'position').map(c => c.id));
            const groups = nodesAfterMove.filter(n => n.type === 'group');

            const finalNodes = nodesAfterMove.map(node => {
                // Only process nodes that were dropped.
                if (!draggedNodeIds.has(node.id) || node.type === 'group') {
                    return node;
                }

                const nodeCenter = {
                    x: node.position.x + (node.width || NODE_WIDTH) / 2,
                    y: node.position.y + (node.height || NODE_HEIGHT) / 2
                };
                
                // Find all potential parent groups that contain the node's center.
                const potentialParents = groups.filter(group => 
                    nodeCenter.x >= group.position.x &&
                    nodeCenter.x < group.position.x + group.data.width &&
                    nodeCenter.y >= group.position.y &&
                    nodeCenter.y < group.position.y + group.data.height
                );

                let newParent = null;
                if (potentialParents.length > 0) {
                    // From the potential parents, choose the one with the highest zIndex.
                    newParent = potentialParents.reduce((top, current) => 
                        (current.zIndex || 1) > (top.zIndex || 1) ? current : top
                    , potentialParents[0]);
                }

                if (newParent) {
                    // Assign the new parent and convert the node's position to be relative to it.
                    return {
                        ...node,
                        position: {
                            x: node.position.x - newParent.position.x,
                            y: node.position.y - newParent.position.y,
                        },
                        parentNode: newParent.id,
                        extent: 'parent',
                    };
                } else {
                    // The node is not inside any group, so ensure it has no parent.
                    const { parentNode, extent, ...rest } = node;
                    return rest;
                }
            });

            return { ...prev, nodes: finalNodes };
        }
        
        // If not a special drag event, just return the updated nodes.
        return { ...prev, nodes: nodesAfterMove };

    }, !isDragEnd); // A history entry is only created on drag end.
}, [setState]);

  const resetMap = useCallback(() => {
    resetState();
    setSelectedElements([]);
    setCurrentNeighbors([]);
  }, [resetState]);
  
  // Expose a function that needs `updateSelection`
  const selectAllByTypeHandler = useCallback((iconType) => {
    selectAllByType(iconType, setSelectedElements);
  }, [selectAllByType, setSelectedElements]);

  return {
    nodes, setNodes: (newNodes) => setState(prev => ({...prev, nodes: typeof newNodes === 'function' ? newNodes(prev.nodes) : newNodes}), true),
    edges, setEdges: (newEdges) => setState(prev => ({...prev, edges: typeof newEdges === 'function' ? newEdges(prev.edges) : newEdges}), true),
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
    selectAllByType: selectAllByTypeHandler,
    currentNeighbors,
    confirmNeighbor,
  };
};