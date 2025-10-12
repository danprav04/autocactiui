// frontend/src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';
import { useHistoryState } from './useHistoryState';
import { useNodeManagement } from './useNodeManagement';
import { useTooling } from './useTooling';
import { calculateSnaps } from './useSnapping';


/**
 * Creates a React Flow edge object.
 * @param {string} sourceId - The ID of the source node.
 * @param {object} neighborInfo - The neighbor data from the API.
 * @param {boolean} [isPreview=false] - Whether the edge is a temporary preview.
 * @returns {object} A complete React Flow edge object.
 */
const createEdgeObject = (sourceId, neighborInfo, isPreview = false) => {
    const { ip, interface: iface } = neighborInfo;
    // A unique ID is crucial for identifying each distinct connection
    const edgeId = `e-${sourceId}-${ip}-${iface.replace(/[/]/g, '-')}`;

    const style = isPreview
        ? { stroke: '#007bff', strokeDasharray: '5 5' }
        // Style for a confirmed, permanent link
        : { stroke: '#6c757d' };

    return {
        id: edgeId,
        source: sourceId,
        target: ip,
        animated: !isPreview,
        style,
        data: {
            isPreview,
            interface: iface
        }
    };
};


export const useMapInteraction = (theme, onShowNeighborPopup) => {
  const { state, setState, undo, redo, resetState } = useHistoryState();
  // Defensive fallback to prevent crash if state is ever undefined during a rapid re-render
  const { nodes, edges } = state || { nodes: [], edges: [] };

  const [selectedElements, setSelectedElements] = useState([]);
  const [currentNeighbors, setCurrentNeighbors] = useState([]);
  const [snapLines, setSnapLines] = useState([]); // State for snap lines
  const [isLoading, setIsLoading] = useState(false); // Local loading state (for API calls)
  const [error, setError] = useState(''); // Local error state
  const { t } = useTranslation();
  const dragContext = useRef(null); // Ref to store context across drag events

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
          if (!prev) return prev;
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
        
        // Remove existing previews, but maintain selection state
        const nodesWithoutPreviews = prev.nodes
          .filter(n => !n.data.isPreview)
          .map(n => ({ ...n, selected: n.id === sourceNode.id })); // Ensure sourceNode remains selected
          
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
        
        const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));

        const neighborsToConnect = allNeighbors.filter(n => nodeIdsOnMap.has(n.ip));
        const neighborsToAddAsPreview = allNeighbors.filter(n => !nodeIdsOnMap.has(n.ip));
        
        const edgesToCreate = [];
        const existingEdgeIds = new Set(edgesWithoutPreviews.map(e => e.id));
        const existingConnections = new Set(
            edgesWithoutPreviews.map(e => [e.source, e.target].sort().join('--'))
        );

        neighborsToConnect.forEach(neighbor => {
            const newEdgeId = `e-${sourceNode.id}-${neighbor.ip}-${neighbor.interface.replace(/[/]/g, '-')}`;
            const connectionKey = [sourceNode.id, neighbor.ip].sort().join('--');
            if (existingEdgeIds.has(newEdgeId) || existingConnections.has(connectionKey)) {
                return;
            }
            edgesToCreate.push(createEdgeObject(sourceNode.id, neighbor, false));
        });
        const edgesWithNewConnections = [...edgesWithoutPreviews, ...edgesToCreate];

        // --- NEW LOGIC: Decide between popup and on-map previews ---
        if (neighborsToAddAsPreview.length > 10) {
            onShowNeighborPopup(neighborsToAddAsPreview, sourceNode);
            setCurrentNeighbors(neighborsToAddAsPreview); // For sidebar message
            setSelectedElements(nodesWithoutPreviews.filter(n => n.id === sourceNode.id)); 
            return { nodes: nodesWithoutPreviews, edges: edgesWithNewConnections };
        }

        setCurrentNeighbors(neighborsToAddAsPreview);
        if (neighborsToAddAsPreview.length === 0) {
            setSelectedElements(nodesWithoutPreviews.filter(n => n.id === sourceNode.id));
            return { nodes: nodesWithoutPreviews, edges: edgesWithNewConnections };
        }
        
        const previewNodes = [];
        const previewEdges = [];
        const radius = 250;
        const angleStep = (2 * Math.PI) / neighborsToAddAsPreview.length;

        neighborsToAddAsPreview.forEach((neighbor, index) => {
            const angle = angleStep * index - (Math.PI / 2);
            const position = {
                x: sourceNode.position.x + radius * Math.cos(angle),
                y: sourceNode.position.y + radius * Math.sin(angle)
            };
            const previewNode = createNodeObject(
                { ip: neighbor.ip, hostname: neighbor.neighbor, type: 'Unknown' }, position
            );
            previewNode.data.isPreview = true;
            previewNodes.push(previewNode);
            previewEdges.push(createEdgeObject(sourceNode.id, neighbor, true));
        });
        
        setSelectedElements(nodesWithoutPreviews.filter(n => n.id === sourceNode.id));
        return { nodes: [...nodesWithoutPreviews, ...previewNodes], edges: [...edgesWithNewConnections, ...previewEdges] };
      });
    } catch (err) {
      setError(t('app.errorFetchNeighbors', { ip: sourceNode.id }));
    } finally {
      setLoading(false);
    }
  }, [setState, createNodeObject, t, onShowNeighborPopup, setSelectedElements]);

  const confirmPreviewNode = useCallback(async (nodeToConfirm, setLoading, setError) => {
    setLoading(true);
    setError('');
    
    // Find the ID of the node that initiated the preview
    const sourceNodeId = edges.find(e => e.target === nodeToConfirm.id && e.data.isPreview)?.source;

    try {
        const deviceResponse = await api.getDeviceInfo(nodeToConfirm.id);
        if (deviceResponse.data.error) {
            throw new Error(`No device info for ${nodeToConfirm.id}`);
        }
        const confirmedNodeData = deviceResponse.data;

        const neighborsResponse = await api.getDeviceNeighbors(nodeToConfirm.id);
        const allNeighborsOfNewNode = neighborsResponse.data.neighbors || [];

        setState(prev => {
            const newNode = createNodeObject(confirmedNodeData, nodeToConfirm.position);
            newNode.selected = false; 

            // Filter out all existing preview elements
            const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview);
            const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
            
            // Remove the node that was just confirmed (it was a preview node in the previous state)
            const nextNodes = nodesWithoutPreviews.filter(n => n.id !== nodeToConfirm.id);
            nextNodes.push(newNode);

            // Re-select the source node that was selected BEFORE the new one was added
            const sourceNode = nextNodes.find(n => n.id === sourceNodeId);
            if (sourceNode) {
                // Ensure only the source node is selected
                nextNodes.forEach(n => n.selected = n.id === sourceNodeId); 
            }
            
            // Promote preview edges connected to the new node to permanent
            const edgesToPromote = prev.edges
                .filter(e => e.data.isPreview && (e.target === nodeToConfirm.id || e.source === nodeToConfirm.id))
                .map(e => ({ ...e, style: { stroke: '#6c757d' }, data: { ...e.data, isPreview: false }, animated: false }));
            
            const nextEdges = [...edgesWithoutPreviews, ...edgesToPromote];

            const permanentNodeIdsOnMap = new Set(nextNodes.filter(n => !n.data.isPreview).map(n => n.id));
            const existingEdgeIds = new Set(nextEdges.map(e => e.id));
            const existingConnections = new Set(nextEdges.map(e => [e.source, e.target].sort().join('--')));
            
            // Add any new connections for the added device to existing permanent nodes
            const neighborsToConnect = allNeighborsOfNewNode.filter(n => permanentNodeIdsOnMap.has(n.ip));
            neighborsToConnect.forEach(neighbor => {
                const newEdgeId = `e-${newNode.id}-${neighbor.ip}-${neighbor.interface.replace(/[/]/g, '-')}`;
                const connectionKey = [newNode.id, neighbor.ip].sort().join('--');
                if (!existingEdgeIds.has(newEdgeId) && !existingConnections.has(connectionKey)) {
                    nextEdges.push(createEdgeObject(newNode.id, neighbor, false));
                }
            });
            
            // --- Re-apply neighbor/preview logic for the source node ---
            if (sourceNode) {
                // Find the original source node's full list of neighbors
                const sourceNeighbors = currentNeighbors;

                const remainingNeighbors = sourceNeighbors.filter(n => !permanentNodeIdsOnMap.has(n.ip));
                setCurrentNeighbors(remainingNeighbors); // Update remaining neighbors in state
                
                // If the source node has many remaining neighbors, open the popup
                if (remainingNeighbors.length > 10) {
                    onShowNeighborPopup(remainingNeighbors, sourceNode);
                    // No on-map previews needed
                    return { nodes: nextNodes, edges: nextEdges };
                }

                // Otherwise, generate previews for the remaining neighbors
                const previewNodes = [];
                const previewEdges = [];
                const radius = 250;
                const angleStep = (2 * Math.PI) / remainingNeighbors.length;
                
                remainingNeighbors.forEach((neighbor, index) => {
                    const angle = angleStep * index - (Math.PI / 2);
                    const position = {
                        x: sourceNode.position.x + radius * Math.cos(angle),
                        y: sourceNode.position.y + radius * Math.sin(angle)
                    };
                    const previewNode = createNodeObject({ ip: neighbor.ip, hostname: neighbor.neighbor, type: 'Unknown' }, position);
                    previewNode.data.isPreview = true;
                    previewNodes.push(previewNode);
                    previewEdges.push(createEdgeObject(sourceNode.id, neighbor, true));
                });

                setSelectedElements([sourceNode]);
                return { nodes: [...nextNodes, ...previewNodes], edges: [...nextEdges, ...previewEdges] };
            }

            // Fallback for unexpected selection state
            setSelectedElements([]);
            setCurrentNeighbors([]);
            return { nodes: nextNodes, edges: nextEdges };
        });

    } catch (err) {
        setError(t('app.errorAddNeighbor', { ip: nodeToConfirm.id }));
        clearPreviewElements();
    } finally {
        setLoading(false);
    }
  }, [edges, currentNeighbors, setState, createNodeObject, clearPreviewElements, t, onShowNeighborPopup, setSelectedElements]);

  const confirmNeighbor = useCallback((neighbor, setLoading, setError) => {
      // Find the preview node by IP (if it exists)
      const nodeToConfirm = nodes.find(n => n.id === neighbor.ip && n.data.isPreview);
      
      if (nodeToConfirm) {
          // If a preview node exists, click it to confirm
          confirmPreviewNode(nodeToConfirm, setLoading, setError);
      } else {
          // If no preview node exists (e.g., adding from a popup), create one manually
          // The coordinates here are placeholders, but the core logic handles the confirmation.
          const dummyNodeToConfirm = {
              id: neighbor.ip,
              position: {x: 0, y: 0}, 
              data: { isPreview: true, hostname: neighbor.neighbor },
          };
          confirmPreviewNode(dummyNodeToConfirm, setLoading, setError);
      }
  }, [nodes, confirmPreviewNode]);

  const onNodeClick = useCallback((event, node, setLoading, setError, isContextMenu = false) => {
    if (node.data.isPreview) {
        confirmPreviewNode(node, setLoading, setError);
        return;
    }
    
    const isNodeAlreadySelected = selectedElements.some(el => el.id === node.id);

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
        newSelectedNodes = [node];
    }

    setSelectedElements(newSelectedNodes);
    clearPreviewElements();

    setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({...n, selected: newSelectedNodes.some(sn => sn.id === n.id)}))
    }), true);

    if (newSelectedNodes.length === 1 && newSelectedNodes[0].type === 'custom') {
        // Pass the App.js-scoped setters for error/loading notification
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
      if (selectedNodes.length !== 1 || (selectedNodes.length === 1 && selectedNodes[0].type !== 'custom')) {
          clearPreviewElements();
          setCurrentNeighbors([]);
      }
  }, [clearPreviewElements]);
  
  const handleDeleteElements = useCallback(() => {
    baseHandleDeleteElements(selectedElements);
    setSelectedElements([]);
  }, [baseHandleDeleteElements, selectedElements]);

  const onNodesChange = useCallback((changes) => {
    const isDrag = changes.some(c => c.type === 'position' && c.dragging);
    const isDragEnd = changes.some(c => c.type === 'position' && c.dragging === false);
    
    // Crucially, we DO NOT check the `isLoading` state here. Dragging is always allowed.
    if (!isDrag && !isDragEnd) {
        setSnapLines([]);
    }

    setState(prev => {
        if (isDrag && !dragContext.current) {
            const context = { childrenMap: new Map() };
            const movedGroupIds = new Set(
                changes
                    .map(c => prev.nodes.find(n => n.id === c.id))
                    .filter(n => n && n.type === 'group')
                    .map(n => n.id)
            );

            if (movedGroupIds.size > 0) {
                const potentialChildren = prev.nodes.filter(n => n.type !== 'group');
                for (const node of potentialChildren) {
                    const parentGroup = prev.nodes
                        .filter(g => movedGroupIds.has(g.id) &&
                            node.position.x >= g.position.x &&
                            (node.position.x + (node.width || NODE_WIDTH)) <= (g.position.x + g.data.width) &&
                            node.position.y >= g.position.y &&
                            (node.position.y + (node.height || NODE_HEIGHT)) <= (g.position.y + g.data.height)
                        )
                        .sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1))[0];
                    
                    if (parentGroup) {
                        if (!context.childrenMap.has(parentGroup.id)) {
                            context.childrenMap.set(parentGroup.id, new Set());
                        }
                        context.childrenMap.get(parentGroup.id).add(node.id);
                    }
                }
            }
            dragContext.current = context;
        }

        if (isDrag) {
            const draggedNodeIds = new Set(changes.filter(c => c.dragging).map(c => c.id));
            const draggedNodes = prev.nodes.filter(n => draggedNodeIds.has(n.id));
            
            const updatedDraggedNodes = draggedNodes.map(dn => {
                const change = changes.find(c => c.id === dn.id && c.position);
                return change ? { ...dn, position: change.position } : dn;
            });
            
            const { snapLines, positionAdjustment } = calculateSnaps(updatedDraggedNodes, prev.nodes);
            setSnapLines(snapLines);

            changes.forEach(change => {
                if (draggedNodeIds.has(change.id) && change.position) {
                    change.position.x += positionAdjustment.x;
                    change.position.y += positionAdjustment.y;
                }
            });
        }

        let nextNodes = applyNodeChanges(changes, prev.nodes);

        if (isDrag && dragContext.current && dragContext.current.childrenMap.size > 0) {
            const groupDeltas = new Map();
            const positionChanges = changes.filter(c => c.type === 'position' && c.position);

            for (const change of positionChanges) {
                const originalNode = prev.nodes.find(n => n.id === change.id);
                if (originalNode && originalNode.type === 'group') {
                    groupDeltas.set(originalNode.id, {
                        dx: change.position.x - originalNode.position.x,
                        dy: change.position.y - originalNode.position.y,
                    });
                }
            }

            if (groupDeltas.size > 0) {
                const directlyMovedNodeIds = new Set(positionChanges.map(c => c.id));
                const childrenToMove = new Map();

                dragContext.current.childrenMap.forEach((childIds, groupId) => {
                    const delta = groupDeltas.get(groupId);
                    if (delta) {
                        childIds.forEach(childId => {
                            if (!directlyMovedNodeIds.has(childId)) {
                                const originalChildNode = prev.nodes.find(n => n.id === childId);
                                if(originalChildNode) {
                                    childrenToMove.set(childId, {
                                        x: originalChildNode.position.x + delta.dx,
                                        y: originalChildNode.position.y + delta.dy,
                                    });
                                }
                            }
                        });
                    }
                });

                nextNodes = nextNodes.map(node => {
                    if (childrenToMove.has(node.id)) {
                        return { ...node, position: childrenToMove.get(node.id) };
                    }
                    return node;
                });
            }
        }
        
        return { ...prev, nodes: nextNodes };

    }, !isDragEnd);

    if (isDragEnd) {
        dragContext.current = null;
        setSnapLines([]);
    }
  }, [setState]);

  const resetMap = useCallback(() => {
    resetState();
    setSelectedElements([]);
    setCurrentNeighbors([]);
  }, [resetState]);
  
  const selectAllByTypeHandler = useCallback((iconType) => {
    selectAllByType(iconType, setSelectedElements);
  }, [selectAllByType, setSelectedElements]);

  return {
    nodes, setNodes: (newNodes) => setState(prev => ({...prev, nodes: typeof newNodes === 'function' ? newNodes(prev.nodes) : newNodes}), true),
    edges, setEdges: (newEdges) => setState(prev => ({...prev, edges: typeof newEdges === 'function' ? newEdges(prev.edges) : newEdges}), true),
    selectedElements,
    snapLines,
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
    confirmPreviewNode,
    setLoading: setIsLoading, // Expose local loading state setter
    setError: setError, // Expose local error state setter
  };
};