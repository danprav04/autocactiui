// frontend/src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';
import { useHistoryState } from './useHistoryState';
import { useNodeManagement } from './useNodeManagement';
import { useTooling } from './useTooling';


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


export const useMapInteraction = (theme) => {
  const { state, setState, undo, redo, resetState } = useHistoryState();
  // Defensive fallback to prevent crash if state is ever undefined during a rapid re-render
  const { nodes, edges } = state || { nodes: [], edges: [] };

  const [selectedElements, setSelectedElements] = useState([]);
  const [currentNeighbors, setCurrentNeighbors] = useState([]);
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
        
        const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview);
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
        const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));

        const neighborsToConnect = allNeighbors.filter(n => nodeIdsOnMap.has(n.ip));
        const neighborsToAddAsPreview = allNeighbors.filter(n => !nodeIdsOnMap.has(n.ip));
        setCurrentNeighbors(neighborsToAddAsPreview);

        const edgesToCreate = [];
        const existingEdgeIds = new Set(edgesWithoutPreviews.map(e => e.id));
        
        // Create a set of existing connections to prevent duplicates from the reverse direction.
        // The key is a sorted combination of source and target IPs.
        const existingConnections = new Set(
            edgesWithoutPreviews.map(e => [e.source, e.target].sort().join('--'))
        );

        neighborsToConnect.forEach(neighbor => {
            const newEdgeId = `e-${sourceNode.id}-${neighbor.ip}-${neighbor.interface.replace(/[/]/g, '-')}`;
            const connectionKey = [sourceNode.id, neighbor.ip].sort().join('--');

            // If an edge with this exact ID already exists OR if a connection between these two nodes
            // has already been established (from the other direction), skip.
            if (existingEdgeIds.has(newEdgeId) || existingConnections.has(connectionKey)) {
                return;
            }
            
            edgesToCreate.push(createEdgeObject(sourceNode.id, neighbor, false));
        });
        const edgesWithNewConnections = [...edgesWithoutPreviews, ...edgesToCreate];

        if (neighborsToAddAsPreview.length === 0) {
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
                .filter(e => !e.data.isPreview || e.target === nodeToConfirm.id || e.source === nodeToConfirm.id)
                .map(e => {
                    if (e.target === nodeToConfirm.id || e.source === nodeToConfirm.id) {
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
    const isDrag = changes.some(c => c.type === 'position' && c.dragging);
    const isDragEnd = changes.some(c => c.type === 'position' && c.dragging === false);

    setState(prev => {
        // --- DRAG START: Identify children of dragged groups ---
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
                            // A node is a child if its entire bounding box is inside the group
                            node.position.x >= g.position.x &&
                            (node.position.x + (node.width || NODE_WIDTH)) <= (g.position.x + g.data.width) &&
                            node.position.y >= g.position.y &&
                            (node.position.y + (node.height || NODE_HEIGHT)) <= (g.position.y + g.data.height)
                        )
                        .sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1))[0]; // Respect z-index
                    
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

        // --- APPLY CHANGES ---
        let nextNodes = applyNodeChanges(changes, prev.nodes);

        // --- GROUP DRAGGING LOGIC ---
        // If groups are being dragged, move their pre-identified children
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

    // After state update, clear the context on drag end
    if (isDragEnd) {
        dragContext.current = null;
    }
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