// frontend/src/hooks/useSnapping.js
import { NODE_WIDTH, NODE_HEIGHT, SNAP_THRESHOLD } from '../config/constants';

/**
 * Calculates all possible snap points for a given node.
 * @param {object} node - The node to calculate points for.
 * @returns {object} An object with arrays of x and y coordinates for centers and edges.
 */
const getNodeSnapPoints = (node) => {
    const width = node.type === 'group' ? node.data.width : (node.width || NODE_WIDTH);
    const height = node.type === 'group' ? node.data.height : (node.height || NODE_HEIGHT);

    const points = {
        x: {
            left: node.position.x,
            center: node.position.x + width / 2,
            right: node.position.x + width,
        },
        y: {
            top: node.position.y,
            center: node.position.y + height / 2,
            bottom: node.position.y + height,
        }
    };

    // Add thirds for groups, or for nodes that are inside a group
    if (node.type === 'group' || node.parentNode) {
        const container = node.type === 'group' ? node : node.parentNode;
        const containerWidth = container.data.width;
        const containerHeight = container.data.height;
        
        points.x.third1 = container.position.x + containerWidth / 3;
        points.x.third2 = container.position.x + (containerWidth * 2) / 3;
        points.y.third1 = container.position.y + containerHeight / 3;
        points.y.third2 = container.position.y + (containerHeight * 2) / 3;
    }


    return points;
};


/**
 * Compares a dragged node against a static node to find snap opportunities.
 * @param {object} draggedNodePoints - Snap points of the node being moved.
 * @param {object} staticNodePoints - Snap points of the stationary node.
 * @param {object} currentAdjustment - The current snap adjustment to be updated.
 */
const findSnaps = (draggedNodePoints, staticNodePoints, currentAdjustment) => {
    const newSnaps = { x: null, y: null };

    // Check horizontal (X-axis) snaps
    for (const dragKey of Object.keys(draggedNodePoints.x)) {
        for (const staticKey of Object.keys(staticNodePoints.x)) {
            const diff = Math.abs(draggedNodePoints.x[dragKey] - staticNodePoints.x[staticKey]);
            if (diff < SNAP_THRESHOLD) {
                const adjustment = staticNodePoints.x[staticKey] - draggedNodePoints.x[dragKey];
                // Use the smallest adjustment that is not zero
                if (Math.abs(adjustment) < Math.abs(currentAdjustment.x)) {
                    currentAdjustment.x = adjustment;
                    newSnaps.x = staticNodePoints.x[staticKey];
                }
            }
        }
    }

    // Check vertical (Y-axis) snaps
    for (const dragKey of Object.keys(draggedNodePoints.y)) {
        for (const staticKey of Object.keys(staticNodePoints.y)) {
            const diff = Math.abs(draggedNodePoints.y[dragKey] - staticNodePoints.y[staticKey]);
            if (diff < SNAP_THRESHOLD) {
                const adjustment = staticNodePoints.y[staticKey] - draggedNodePoints.y[dragKey];
                if (Math.abs(adjustment) < Math.abs(currentAdjustment.y)) {
                    currentAdjustment.y = adjustment;
                    newSnaps.y = staticNodePoints.y[staticKey];
                }
            }
        }
    }

    return newSnaps;
};

/**
 * Calculates snapping adjustments and guide lines for dragged nodes.
 * @param {Array} draggedNodes - An array of nodes currently being dragged.
 * @param {Array} allNodes - The complete list of all nodes on the map.
 * @returns {object} An object containing the position adjustment and an array of snap lines.
 */
export const calculateSnaps = (draggedNodes, allNodes) => {
    if (!draggedNodes || draggedNodes.length === 0) {
        return { snapLines: [], positionAdjustment: { x: 0, y: 0 } };
    }
    
    const draggedIds = new Set(draggedNodes.map(n => n.id));
    // Add parent group info to all nodes for contextual snapping.
    const processedNodes = allNodes.map(n => {
        if (n.parentNode) {
            return { ...n, parentNode: allNodes.find(p => p.id === n.parentNode) };
        }
        return n;
    });

    const staticNodes = processedNodes.filter(n => !draggedIds.has(n.id));
    if (staticNodes.length === 0) {
         return { snapLines: [], positionAdjustment: { x: 0, y: 0 } };
    }

    // Map updated positions for quick lookup.
    const newPositions = new Map(draggedNodes.map(n => [n.id, n.position]));
    
    const enrichedDraggedNodes = processedNodes
        .filter(n => draggedIds.has(n.id))
        .map(n => ({
            ...n,
            position: newPositions.get(n.id) || n.position
        }));

    const staticNodePoints = staticNodes.map(getNodeSnapPoints);
    let positionAdjustment = { x: SNAP_THRESHOLD, y: SNAP_THRESHOLD };

    // --- 1. Find the single best snap adjustment for the entire selection ---
    enrichedDraggedNodes.forEach(draggedNode => {
        const draggedNodePoints = getNodeSnapPoints(draggedNode);
        staticNodePoints.forEach(staticPoints => {
            findSnaps(draggedNodePoints, staticPoints, positionAdjustment);
        });
    });

    // If no snap was found, reset adjustment to zero
    if (Math.abs(positionAdjustment.x) === SNAP_THRESHOLD) positionAdjustment.x = 0;
    if (Math.abs(positionAdjustment.y) === SNAP_THRESHOLD) positionAdjustment.y = 0;

    // --- 2. Generate individual visual snap lines based on the final adjusted position ---
    const snapLines = [];
    if (positionAdjustment.x === 0 && positionAdjustment.y === 0) {
        return { snapLines: [], positionAdjustment };
    }

    enrichedDraggedNodes.forEach(draggedNode => {
        // Calculate the node's final position after snapping
        const finalPosition = {
            x: draggedNode.position.x + positionAdjustment.x,
            y: draggedNode.position.y + positionAdjustment.y
        };
        const finalDraggedPoints = getNodeSnapPoints({ ...draggedNode, position: finalPosition });

        staticNodes.forEach(staticNode => {
            const staticPoints = getNodeSnapPoints(staticNode);

            // Check for vertical alignment
            if (positionAdjustment.x !== 0) {
                for (const dragKey of Object.keys(finalDraggedPoints.x)) {
                    for (const staticKey of Object.keys(staticPoints.x)) {
                        // Check if the points align after adjustment
                        if (Math.abs(finalDraggedPoints.x[dragKey] - staticPoints.x[staticKey]) < 1) {
                            const y1 = Math.min(finalDraggedPoints.y.top, staticPoints.y.top);
                            const y2 = Math.max(finalDraggedPoints.y.bottom, staticPoints.y.bottom);
                            snapLines.push({ type: 'vertical', x: staticPoints.x[staticKey], y1, y2 });
                        }
                    }
                }
            }
            
            // Check for horizontal alignment
            if (positionAdjustment.y !== 0) {
                 for (const dragKey of Object.keys(finalDraggedPoints.y)) {
                    for (const staticKey of Object.keys(staticPoints.y)) {
                        if (Math.abs(finalDraggedPoints.y[dragKey] - staticPoints.y[staticKey]) < 1) {
                            const x1 = Math.min(finalDraggedPoints.x.left, staticPoints.x.left);
                            const x2 = Math.max(finalDraggedPoints.x.right, staticPoints.x.right);
                            snapLines.push({ type: 'horizontal', y: staticPoints.y[staticKey], x1, x2 });
                        }
                    }
                }
            }
        });
    });

    // Deduplicate lines to avoid drawing the same line multiple times
    const uniqueLines = Array.from(new Map(snapLines.map(line => [`${line.type}-${line.x || line.y}-${line.x1 || line.y1}`, line])).values());

    return { snapLines: uniqueLines, positionAdjustment };
};