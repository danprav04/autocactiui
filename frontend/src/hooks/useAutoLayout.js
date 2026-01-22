// frontend/src/hooks/useAutoLayout.js
import { useCallback } from 'react';
import { NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

/**
 * Device type hierarchy - lower number = higher in the visual hierarchy (top of map)
 */
const DEVICE_HIERARCHY = {
    'Router': 1,
    'Firewall': 2,
    'Encryptor': 3,
    'Switch': 4,
    'Unknown': 5,
};

const BASE_LEVEL_HEIGHT = 200; // Base vertical spacing between hierarchy levels
const EXTRA_HEIGHT_PER_CHILD = 15; // Extra vertical space per child when parent has many children
const MANY_CHILDREN_THRESHOLD = 4; // Threshold to start adding extra vertical space
const NODE_SPACING = 180; // Horizontal spacing between nodes
const BASE_Y = 100; // Starting Y position for top-level nodes
const GROUP_PADDING = 40; // Padding inside groups

/**
 * Get the hierarchy level for a device type
 */
const getHierarchyLevel = (iconType) => {
    return DEVICE_HIERARCHY[iconType] || DEVICE_HIERARCHY['Unknown'];
};

/**
 * Calculate dynamic level height based on number of children
 */
const calculateLevelHeight = (childCount) => {
    if (childCount <= MANY_CHILDREN_THRESHOLD) {
        return BASE_LEVEL_HEIGHT;
    }
    return BASE_LEVEL_HEIGHT + (childCount - MANY_CHILDREN_THRESHOLD) * EXTRA_HEIGHT_PER_CHILD;
};

/**
 * Check if a device node is inside a group node
 */
const isNodeInsideGroup = (node, groupNode) => {
    if (!groupNode || groupNode.type !== 'group') return false;
    const groupWidth = groupNode.data?.width || 200;
    const groupHeight = groupNode.data?.height || 200;

    return (
        node.position.x >= groupNode.position.x &&
        node.position.x + NODE_WIDTH <= groupNode.position.x + groupWidth &&
        node.position.y >= groupNode.position.y &&
        node.position.y + NODE_HEIGHT <= groupNode.position.y + groupHeight
    );
};

/**
 * Find which group a node belongs to
 */
const findContainingGroup = (node, groups) => {
    for (const group of groups) {
        if (isNodeInsideGroup(node, group)) {
            return group;
        }
    }
    return null;
};

/**
 * Calculate smart position for a new node based on its type and source node.
 * Places nodes hierarchically: routers at top, switches below, etc.
 * Avoids overlap with existing nodes at the same level.
 * 
 * @param {object} sourceNode - The parent node connecting to this new node
 * @param {string} newNodeType - The icon type of the new node (e.g., 'Router', 'Switch')
 * @param {array} existingNodes - All current nodes on the map
 * @returns {object} Position { x, y } for the new node
 */
export const calculateSmartPosition = (sourceNode, newNodeType, existingNodes) => {
    const sourceHierarchy = getHierarchyLevel(sourceNode.data?.iconType);
    const newHierarchy = getHierarchyLevel(newNodeType);

    // Calculate Y position based on relative hierarchy
    let targetY;
    if (newHierarchy > sourceHierarchy) {
        // New node is lower in hierarchy (e.g., switch under router)
        targetY = sourceNode.position.y + BASE_LEVEL_HEIGHT;
    } else if (newHierarchy < sourceHierarchy) {
        // New node is higher in hierarchy (unusual case, e.g., router connected to switch)
        targetY = sourceNode.position.y - BASE_LEVEL_HEIGHT;
    } else {
        // Same level - place beside with slight offset
        targetY = sourceNode.position.y + 50;
    }

    // Ensure Y doesn't go negative
    targetY = Math.max(BASE_Y, targetY);

    // Find nodes at similar Y level (within BASE_LEVEL_HEIGHT/2 range)
    const nodesAtLevel = existingNodes.filter(n =>
        n.type === 'custom' &&
        Math.abs(n.position.y - targetY) < BASE_LEVEL_HEIGHT / 2
    );

    // Calculate X position to avoid overlap
    let targetX = sourceNode.position.x;

    if (nodesAtLevel.length > 0) {
        // Find occupied X positions
        const occupiedRanges = nodesAtLevel.map(n => ({
            left: n.position.x - NODE_SPACING / 2,
            right: n.position.x + NODE_WIDTH + NODE_SPACING / 2
        }));

        // Try positions starting from source X, alternating left and right
        const directions = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];

        for (const dir of directions) {
            const candidateX = sourceNode.position.x + (dir * NODE_SPACING);
            const isOccupied = occupiedRanges.some(range =>
                candidateX > range.left && candidateX < range.right
            );

            if (!isOccupied && candidateX >= 50) {
                targetX = candidateX;
                break;
            }
        }
    }

    return { x: targetX, y: targetY };
};

/**
 * Layout devices within a single group
 */
const layoutDevicesInGroup = (deviceNodes, edges, groupNode) => {
    if (deviceNodes.length === 0) return [];

    const groupWidth = groupNode.data?.width || 200;
    const groupHeight = groupNode.data?.height || 200;
    const groupX = groupNode.position.x;
    const groupY = groupNode.position.y;

    // Simple grid layout inside the group
    const cols = Math.ceil(Math.sqrt(deviceNodes.length));
    const cellWidth = (groupWidth - 2 * GROUP_PADDING) / cols;
    const cellHeight = (groupHeight - 2 * GROUP_PADDING) / Math.ceil(deviceNodes.length / cols);

    return deviceNodes.map((node, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
            ...node,
            position: {
                x: groupX + GROUP_PADDING + col * cellWidth + cellWidth / 2 - NODE_WIDTH / 2,
                y: groupY + GROUP_PADDING + row * cellHeight + cellHeight / 2 - NODE_HEIGHT / 2
            }
        };
    });
};

/**
 * Auto-layout all nodes in a proper tree structure.
 * - Children are positioned directly beneath their parent nodes.
 * - Dynamic vertical spacing based on number of children.
 * - Groups are treated as single units; devices inside are sorted separately.
 * 
 * @param {array} nodes - All nodes on the map
 * @param {array} edges - All edges connecting nodes
 * @returns {array} Nodes with updated positions
 */
export const autoLayoutAllNodes = (nodes, edges) => {
    // Separate node types
    const groupNodes = nodes.filter(n => n.type === 'group');
    const deviceNodes = nodes.filter(n => n.type === 'custom');
    const textNodes = nodes.filter(n => n.type === 'text');

    if (deviceNodes.length === 0) {
        return nodes;
    }

    // Identify which devices are inside which groups
    const deviceToGroup = new Map();
    const groupToDevices = new Map();

    groupNodes.forEach(g => groupToDevices.set(g.id, []));

    deviceNodes.forEach(device => {
        const containingGroup = findContainingGroup(device, groupNodes);
        if (containingGroup) {
            deviceToGroup.set(device.id, containingGroup.id);
            groupToDevices.get(containingGroup.id).push(device);
        }
    });

    // Devices NOT in any group - these participate in the main tree layout
    const freeDevices = deviceNodes.filter(d => !deviceToGroup.has(d.id));

    // Build adjacency list for free devices only
    const adjacency = new Map();
    freeDevices.forEach(n => adjacency.set(n.id, new Set()));

    edges.forEach(e => {
        // Only include edges between free devices
        if (adjacency.has(e.source) && adjacency.has(e.target)) {
            adjacency.get(e.source).add(e.target);
            adjacency.get(e.target).add(e.source);
        }
    });

    // If no free devices, just layout devices inside groups
    if (freeDevices.length === 0) {
        const repositionedGroupDevices = [];
        groupNodes.forEach(group => {
            const devicesInGroup = groupToDevices.get(group.id) || [];
            const layouted = layoutDevicesInGroup(devicesInGroup, edges, group);
            repositionedGroupDevices.push(...layouted);
        });
        return [...repositionedGroupDevices, ...groupNodes, ...textNodes];
    }

    // Find root node - prefer routers, then by most connections
    const sortedByHierarchy = [...freeDevices].sort((a, b) => {
        const levelA = getHierarchyLevel(a.data?.iconType);
        const levelB = getHierarchyLevel(b.data?.iconType);
        if (levelA !== levelB) return levelA - levelB;
        const connectionsA = adjacency.get(a.id)?.size || 0;
        const connectionsB = adjacency.get(b.id)?.size || 0;
        return connectionsB - connectionsA;
    });

    // Build tree structure using BFS from root
    const root = sortedByHierarchy[0];
    const parent = new Map();
    const children = new Map();
    const visited = new Set();
    const queue = [root.id];

    visited.add(root.id);
    parent.set(root.id, null);
    children.set(root.id, []);

    while (queue.length > 0) {
        const currentId = queue.shift();
        const neighbors = adjacency.get(currentId) || new Set();

        neighbors.forEach(neighborId => {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                parent.set(neighborId, currentId);
                children.set(neighborId, []);
                children.get(currentId).push(neighborId);
                queue.push(neighborId);
            }
        });
    }

    // Handle disconnected free devices - make them children of root
    freeDevices.forEach(n => {
        if (!visited.has(n.id)) {
            visited.add(n.id);
            parent.set(n.id, root.id);
            children.set(n.id, []);
            children.get(root.id).push(n.id);
        }
    });

    // Calculate subtree widths for proper spacing
    const subtreeWidth = new Map();

    const calculateSubtreeWidth = (nodeId) => {
        const nodeChildren = children.get(nodeId) || [];
        if (nodeChildren.length === 0) {
            subtreeWidth.set(nodeId, NODE_SPACING);
            return NODE_SPACING;
        }

        let totalWidth = 0;
        nodeChildren.forEach(childId => {
            totalWidth += calculateSubtreeWidth(childId);
        });

        subtreeWidth.set(nodeId, Math.max(NODE_SPACING, totalWidth));
        return subtreeWidth.get(nodeId);
    };

    calculateSubtreeWidth(root.id);

    // Calculate cumulative Y positions based on dynamic level heights
    const levelYPositions = new Map();
    const maxChildrenAtLevel = new Map();

    // First pass: calculate max children at each parent level
    const calculateMaxChildren = (nodeId, level) => {
        const nodeChildren = children.get(nodeId) || [];
        if (nodeChildren.length > 0) {
            const currentMax = maxChildrenAtLevel.get(level) || 0;
            maxChildrenAtLevel.set(level, Math.max(currentMax, nodeChildren.length));
        }
        nodeChildren.forEach(childId => calculateMaxChildren(childId, level + 1));
    };
    calculateMaxChildren(root.id, 0);

    // Second pass: calculate cumulative Y positions
    let cumulativeY = BASE_Y;
    const maxLevel = Math.max(...maxChildrenAtLevel.keys(), 0);
    for (let level = 0; level <= maxLevel + 1; level++) {
        levelYPositions.set(level, cumulativeY);
        const childCount = maxChildrenAtLevel.get(level) || 0;
        cumulativeY += calculateLevelHeight(childCount);
    }

    // Calculate node levels (depth in tree)
    const nodeLevel = new Map();
    const calculateLevels = (nodeId, level) => {
        nodeLevel.set(nodeId, level);
        const nodeChildren = children.get(nodeId) || [];
        nodeChildren.forEach(childId => calculateLevels(childId, level + 1));
    };
    calculateLevels(root.id, 0);

    // Position nodes - root at top center, children spread below their parents
    const newPositions = new Map();
    const centerX = 400;

    const positionNode = (nodeId, leftBound, rightBound) => {
        const level = nodeLevel.get(nodeId);
        const nodeX = (leftBound + rightBound) / 2;
        const yPos = levelYPositions.get(level) || BASE_Y;

        newPositions.set(nodeId, {
            x: nodeX - NODE_WIDTH / 2,
            y: yPos
        });

        // Position children
        const nodeChildren = children.get(nodeId) || [];
        if (nodeChildren.length > 0) {
            // Sort children by device hierarchy for visual consistency
            const sortedChildren = [...nodeChildren].sort((a, b) => {
                const nodeA = freeDevices.find(n => n.id === a);
                const nodeB = freeDevices.find(n => n.id === b);
                return getHierarchyLevel(nodeA?.data?.iconType) - getHierarchyLevel(nodeB?.data?.iconType);
            });

            // Calculate total width needed for all children
            let totalChildWidth = 0;
            sortedChildren.forEach(childId => {
                totalChildWidth += subtreeWidth.get(childId);
            });

            // Position children centered under parent
            let childLeft = nodeX - totalChildWidth / 2;
            sortedChildren.forEach(childId => {
                const childWidth = subtreeWidth.get(childId);
                positionNode(childId, childLeft, childLeft + childWidth);
                childLeft += childWidth;
            });
        }
    };

    // Start positioning from root
    const rootWidth = subtreeWidth.get(root.id);
    positionNode(root.id, centerX - rootWidth / 2, centerX + rootWidth / 2);

    // Apply new positions to free device nodes
    const repositionedFreeDevices = freeDevices.map(n => ({
        ...n,
        position: newPositions.get(n.id) || n.position
    }));

    // Layout devices inside groups separately
    const repositionedGroupDevices = [];
    groupNodes.forEach(group => {
        const devicesInGroup = groupToDevices.get(group.id) || [];
        const layouted = layoutDevicesInGroup(devicesInGroup, edges, group);
        repositionedGroupDevices.push(...layouted);
    });

    // Return all nodes with devices repositioned
    return [...repositionedFreeDevices, ...repositionedGroupDevices, ...groupNodes, ...textNodes];
};

/**
 * Custom hook for auto-layout functionality.
 * Provides memoized callbacks for calculating positions and restructuring the map.
 */
export const useAutoLayout = () => {
    const getSmartPosition = useCallback((sourceNode, newNodeType, existingNodes) => {
        return calculateSmartPosition(sourceNode, newNodeType, existingNodes);
    }, []);

    const autoLayoutNodes = useCallback((nodes, edges) => {
        return autoLayoutAllNodes(nodes, edges);
    }, []);

    return {
        getSmartPosition,
        autoLayoutNodes
    };
};

export default useAutoLayout;
