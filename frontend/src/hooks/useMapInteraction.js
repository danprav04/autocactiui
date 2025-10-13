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
 * @param {string} targetId - The ID of the target node.
 * @param {object} neighborInfo - The neighbor data from the API.
 * @param {boolean} [isPreview=false] - Whether the edge is a temporary preview.
 * @returns {object} A complete React Flow edge object.
 */
const createEdgeObject = (sourceId, targetId, neighborInfo, isPreview = false) => {
    const { interface: iface } = neighborInfo;
    const safeInterface = iface ? iface.replace(/[/]/g, '-') : 'unknown';
    const edgeId = `e-${sourceId}-${targetId}-${safeInterface}`;

    const style = isPreview
        ? { stroke: '#007bff', strokeDasharray: '5 5' }
        : { stroke: '#6c757d' };

    return {
        id: edgeId,
        source: sourceId,
        target: targetId,
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
  const { nodes, edges } = state || { nodes: [], edges: [] };

  const [selectedElements, setSelectedElements] = useState([]);
  const [currentNeighbors, setCurrentNeighbors] = useState([]);
  const [snapLines, setSnapLines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const dragContext = useRef(null);

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
    }), true);
  }, [theme, setState]);
  
  const clearPreviewElements = useCallback(() => {
      setState(prev => {
          if (!prev) return prev;
          const nextNodes = prev.nodes.filter(n => !n.data.isPreview);
          const nextEdges = prev.edges.filter(e => !e.data.isPreview);
          if (nextNodes.length < prev.nodes.length || nextEdges.length < prev.edges.length) {
              return { nodes: nextNodes, edges: nextEdges };
          }
          return prev;
      }, true);
  }, [setState]);

  const handleFetchNeighbors = useCallback(async (sourceNode, setLoading, setError) => {
    setLoading(true); setError('');
    setCurrentNeighbors([]);
    try {
      const response = await api.getDeviceNeighbors(sourceNode.id);
      const allNeighbors = response.data.neighbors;

      setState(prev => {
        if (!prev) return prev;
        
        const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview).map(n => ({ ...n, selected: n.id === sourceNode.id }));
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
        const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));

        const neighborsToConnect = allNeighbors.filter(n => n.ip && nodeIdsOnMap.has(n.ip));
        const neighborsToAddAsPreview = allNeighbors.filter(n => n.ip ? !nodeIdsOnMap.has(n.ip) : true);
        
        const edgesToCreate = [];
        const existingConnections = new Set(edgesWithoutPreviews.map(e => [e.source, e.target].sort().join('--')));

        neighborsToConnect.forEach(neighbor => {
            const connectionKey = [sourceNode.id, neighbor.ip].sort().join('--');
            if (!existingConnections.has(connectionKey)) {
                edgesToCreate.push(createEdgeObject(sourceNode.id, neighbor.ip, neighbor, false));
            }
        });
        const edgesWithNewConnections = [...edgesWithoutPreviews, ...edgesToCreate];

        if (neighborsToAddAsPreview.length > 10) {
            onShowNeighborPopup(neighborsToAddAsPreview, sourceNode);
            setCurrentNeighbors(neighborsToAddAsPreview);
            setSelectedElements(nodesWithoutPreviews.filter(n => n.id === sourceNode.id)); 
            return { nodes: nodesWithoutPreviews, edges: edgesWithNewConnections };
        }

        setCurrentNeighbors(neighborsToAddAsPreview);
        if (neighborsToAddAsPreview.length === 0) {
            setSelectedElements(nodesWithoutPreviews.filter(n => n.id === sourceNode.id));
            return { nodes: nodesWithoutPreviews, edges: edgesWithNewConnections };
        }
        
        const previewNodes = [], previewEdges = [];
        const radius = 250;
        const angleStep = (2 * Math.PI) / neighborsToAddAsPreview.length;

        neighborsToAddAsPreview.forEach((neighbor, index) => {
            const angle = angleStep * index - (Math.PI / 2);
            const position = { x: sourceNode.position.x + radius * Math.cos(angle), y: sourceNode.position.y + radius * Math.sin(angle) };
            const previewNode = createNodeObject({ ip: neighbor.ip, hostname: neighbor.neighbor, type: 'Unknown' }, position);
            previewNode.data.isPreview = true;
            previewNodes.push(previewNode);
            previewEdges.push(createEdgeObject(sourceNode.id, previewNode.id, neighbor, true));
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

    const isEndDevice = !nodeToConfirm.data.ip;
    const isFromList = nodeToConfirm.data.isFromList;

    const { sourceNodeId, neighborInfo } = (() => {
        if (isFromList) {
            return { sourceNodeId: nodeToConfirm.data.sourceNodeId, neighborInfo: nodeToConfirm.data };
        }
        const edge = edges.find(e => e.target === nodeToConfirm.id && e.data.isPreview);
        return { sourceNodeId: edge?.source, neighborInfo: { ...nodeToConfirm.data, interface: edge?.data.interface }};
    })();

    if (!sourceNodeId) {
        setError(t('app.errorAddNeighborGeneric'));
        setLoading(false);
        return;
    }

    const handleStateUpdate = (prev, newNode, newEdges = []) => {
        const sourceNode = prev.nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return prev;
        
        const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview && n.id !== nodeToConfirm.id);
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
        
        const nextNodes = [...nodesWithoutPreviews, newNode];
        nextNodes.forEach(n => n.selected = n.id === sourceNodeId);
        
        const nextEdges = [...edgesWithoutPreviews, ...newEdges];
        setSelectedElements([sourceNode]);

        const permanentNodeIpsOnMap = new Set(nextNodes.filter(n => n.data.ip).map(n => n.data.ip));
        const remainingNeighbors = currentNeighbors.filter(n => {
            if (n.ip) return !permanentNodeIpsOnMap.has(n.ip);
            return !(n.neighbor === neighborInfo.neighbor && n.interface === neighborInfo.interface);
        });
        setCurrentNeighbors(remainingNeighbors);

        const previewNodes = [], previewEdges = [];
        if (remainingNeighbors.length > 0 && remainingNeighbors.length <= 10) {
            const radius = 250;
            const angleStep = (2 * Math.PI) / remainingNeighbors.length;
            remainingNeighbors.forEach((neighbor, index) => {
                const angle = angleStep * index - (Math.PI / 2);
                const pos = { x: sourceNode.position.x + radius * Math.cos(angle), y: sourceNode.position.y + radius * Math.sin(angle) };
                const pNode = createNodeObject({ ip: neighbor.ip, hostname: neighbor.neighbor, type: 'Unknown' }, pos);
                pNode.data.isPreview = true;
                previewNodes.push(pNode);
                previewEdges.push(createEdgeObject(sourceNode.id, pNode.id, neighbor, true));
            });
        } else if (remainingNeighbors.length > 10) {
            onShowNeighborPopup(remainingNeighbors, sourceNode);
        }

        return { nodes: [...nextNodes, ...previewNodes], edges: [...nextEdges, ...previewEdges] };
    };

    if (isEndDevice) {
        setState(prev => {
            const sourceNode = prev.nodes.find(n => n.id === sourceNodeId);
            if (!sourceNode) return prev;
            const position = { x: sourceNode.position.x + (Math.random() * 300 - 150), y: sourceNode.position.y + 200 };
            const newNode = createNodeObject({ ip: '', hostname: neighborInfo.neighbor, type: 'Switch' }, position);
            const newEdge = createEdgeObject(sourceNodeId, newNode.id, neighborInfo, false);
            return handleStateUpdate(prev, newNode, [newEdge]);
        });
        setLoading(false);
        return;
    }

    try {
        const deviceResponse = await api.getDeviceInfo(nodeToConfirm.data.ip);
        if (deviceResponse.data.error) throw new Error(`No device info for ${nodeToConfirm.data.ip}`);
        
        const confirmedNodeData = deviceResponse.data;
        const neighborsResponse = await api.getDeviceNeighbors(nodeToConfirm.data.ip);
        const allNeighborsOfNewNode = neighborsResponse.data.neighbors || [];

        setState(prev => {
            const sourceNode = prev.nodes.find(n => n.id === sourceNodeId);
            if (!sourceNode) return prev;

            const position = isFromList 
                ? { x: sourceNode.position.x + (Math.random() * 300 - 150), y: sourceNode.position.y + 200 } 
                : nodeToConfirm.position;

            const newNode = createNodeObject(confirmedNodeData, position);

            const edgesToPromote = isFromList 
                ? [createEdgeObject(sourceNodeId, newNode.id, neighborInfo, false)]
                : prev.edges.filter(e => e.data.isPreview && e.target === nodeToConfirm.id).map(e => ({ ...e, id: `e-${e.source}-${newNode.id}-${e.data.interface.replace(/[/]/g, '-')}`, target: newNode.id, data: { ...e.data, isPreview: false }, animated: false, style: { stroke: '#6c757d' }}));
            
            let tempState = handleStateUpdate(prev, newNode, edgesToPromote);
            
            const permanentNodeIdsOnMap = new Set(tempState.nodes.map(n => n.id));
            const existingConnections = new Set(tempState.edges.map(e => [e.source, e.target].sort().join('--')));
            
            const neighborsToConnect = allNeighborsOfNewNode.filter(n => n.ip && permanentNodeIdsOnMap.has(n.ip));
            neighborsToConnect.forEach(neighbor => {
                const connectionKey = [newNode.id, neighbor.ip].sort().join('--');
                if (!existingConnections.has(connectionKey)) {
                    tempState.edges.push(createEdgeObject(newNode.id, neighbor.ip, neighbor, false));
                }
            });
            return tempState;
        });
    } catch (err) {
        setError(t('app.errorAddNeighbor', { ip: nodeToConfirm.data.ip }));
        clearPreviewElements();
    } finally {
        setLoading(false);
    }
  }, [edges, currentNeighbors, setState, createNodeObject, clearPreviewElements, t, onShowNeighborPopup, setSelectedElements]);

  const confirmNeighbor = useCallback((neighbor, sourceNodeId, setLoading, setError) => {
    const onMapPreviewNode = nodes.find(n => n.id === neighbor.ip && n.data.isPreview);

    if (onMapPreviewNode) {
        confirmPreviewNode(onMapPreviewNode, setLoading, setError);
    } else {
        const dummyNodeToConfirm = {
            id: neighbor.ip || `temp-id-${neighbor.neighbor}-${neighbor.interface}`,
            position: { x: 0, y: 0 },
            data: { ...neighbor, isPreview: true, isFromList: true, sourceNodeId: sourceNodeId },
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
    if (isContextMenu && isNodeAlreadySelected) return;

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

    const selectedNode = newSelectedNodes[0];
    if (newSelectedNodes.length === 1 && selectedNode.type === 'custom' && selectedNode.data.ip) {
        handleFetchNeighbors(selectedNode, setLoading, setError); 
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
    
    if (!isDrag && !isDragEnd) {
        setSnapLines([]);
    }

    setState(prev => {
        if (isDrag && !dragContext.current) {
            const context = { childrenMap: new Map() };
            const movedGroupIds = new Set(
                changes.map(c => prev.nodes.find(n => n.id === c.id)).filter(n => n && n.type === 'group').map(n => n.id)
            );

            if (movedGroupIds.size > 0) {
                const potentialChildren = prev.nodes.filter(n => n.type !== 'group');
                for (const node of potentialChildren) {
                    const parentGroup = prev.nodes
                        .filter(g => movedGroupIds.has(g.id) &&
                            node.position.x >= g.position.x && (node.position.x + (node.width || NODE_WIDTH)) <= (g.position.x + g.data.width) &&
                            node.position.y >= g.position.y && (node.position.y + (node.height || NODE_HEIGHT)) <= (g.position.y + g.data.height)
                        ).sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1))[0];
                    if (parentGroup) {
                        if (!context.childrenMap.has(parentGroup.id)) context.childrenMap.set(parentGroup.id, new Set());
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
                    groupDeltas.set(originalNode.id, { dx: change.position.x - originalNode.position.x, dy: change.position.y - originalNode.position.y });
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
                                    childrenToMove.set(childId, { x: originalChildNode.position.x + delta.dx, y: originalChildNode.position.y + delta.dy });
                                }
                            }
                        });
                    }
                });
                nextNodes = nextNodes.map(node => childrenToMove.has(node.id) ? { ...node, position: childrenToMove.get(node.id) } : node);
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
    setLoading: setIsLoading,
    setError: setError,
  };
};