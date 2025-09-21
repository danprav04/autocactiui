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
    // This is crucial for the original getNodeSnapPoints logic to work.
    const processedNodes = allNodes.map(n => {
        if (n.parentNode) {
            return { ...n, parentNode: allNodes.find(p => p.id === n.parentNode) };
        }
        return n;
    });

    const staticNodes = processedNodes.filter(n => !draggedIds.has(n.id));

    // Create a map of updated positions for quick lookup.
    const newPositions = new Map(draggedNodes.map(n => [n.id, n.position]));
    
    // Get the dragged nodes from the processed list (so they have parentNode objects)
    // and apply their new, updated positions from the drag event.
    const enrichedDraggedNodes = processedNodes
        .filter(n => draggedIds.has(n.id))
        .map(n => ({
            ...n,
            position: newPositions.get(n.id) || n.position // Fallback to old position
        }));

    const staticNodePoints = staticNodes.map(getNodeSnapPoints);
    const snapLines = [];
    
    // Initialize with a large value
    let positionAdjustment = { x: SNAP_THRESHOLD, y: SNAP_THRESHOLD };

    // Find the best snap for each dragged node
    enrichedDraggedNodes.forEach(draggedNode => {
        const draggedNodePoints = getNodeSnapPoints(draggedNode);
        staticNodePoints.forEach(staticPoints => {
            findSnaps(draggedNodePoints, staticPoints, positionAdjustment);
        });
    });

    // If no snap was found, reset adjustment to zero
    if (Math.abs(positionAdjustment.x) === SNAP_THRESHOLD) positionAdjustment.x = 0;
    if (Math.abs(positionAdjustment.y) === SNAP_THRESHOLD) positionAdjustment.y = 0;

    // --- Generate Snap Line visuals ---
    // After adjustments are calculated, find which lines to draw
    if (positionAdjustment.x !== 0) {
        // Use the first dragged node as a reference
        const referenceNode = enrichedDraggedNodes[0];
        const finalX = referenceNode.position.x + positionAdjustment.x;
        const finalPoints = getNodeSnapPoints({...referenceNode, position: {x: finalX, y: referenceNode.position.y}});

        for (const key in finalPoints.x) {
            const finalCoord = finalPoints.x[key];
            // FIX: Check against all of a static node's points, not just the same 'key'.
            const matchingStaticPoints = staticNodePoints.filter(sp => 
                Object.values(sp.x).some(val => Math.abs(val - finalCoord) < 1)
            );

            if (matchingStaticPoints.length > 0) {
                let minY = Infinity, maxY = -Infinity;
                 enrichedDraggedNodes.forEach(dn => {
                    const dnPoints = getNodeSnapPoints({ ...dn, position: { ...dn.position, x: dn.position.x + positionAdjustment.x } });
                    minY = Math.min(minY, dnPoints.y.top);
                    maxY = Math.max(maxY, dnPoints.y.bottom);
                });
                matchingStaticPoints.forEach(msp => {
                    minY = Math.min(minY, msp.y.top);
                    maxY = Math.max(maxY, msp.y.bottom);
                });
                snapLines.push({ type: 'vertical', x: finalCoord, y1: minY, y2: maxY });
                break; // Found a snap for this axis, no need to check other keys (left, center, right, etc.)
            }
        }
    }
    
    if (positionAdjustment.y !== 0) {
        const referenceNode = enrichedDraggedNodes[0];
        const finalY = referenceNode.position.y + positionAdjustment.y;
        const finalPoints = getNodeSnapPoints({...referenceNode, position: {x: referenceNode.position.x, y: finalY}});

        for (const key in finalPoints.y) {
            const finalCoord = finalPoints.y[key];
            // FIX: Check against all of a static node's points.
            const matchingStaticPoints = staticNodePoints.filter(sp => 
                Object.values(sp.y).some(val => Math.abs(val - finalCoord) < 1)
            );

            if (matchingStaticPoints.length > 0) {
                 let minX = Infinity, maxX = -Infinity;
                 enrichedDraggedNodes.forEach(dn => {
                    const dnPoints = getNodeSnapPoints({ ...dn, position: { ...dn.position, y: dn.position.y + positionAdjustment.y } });
                    minX = Math.min(minX, dnPoints.x.left);
                    maxX = Math.max(maxX, dnPoints.x.right);
                });
                matchingStaticPoints.forEach(msp => {
                    minX = Math.min(minX, msp.x.left);
                    maxX = Math.max(maxX, msp.x.right);
                });
                snapLines.push({ type: 'horizontal', y: finalCoord, x1: minX, x2: maxX });
                break;
            }
        }
    }

    return { snapLines, positionAdjustment };
};