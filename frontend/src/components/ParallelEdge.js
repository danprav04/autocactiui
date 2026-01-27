import React, { memo } from 'react';
import { getBezierPath, getEdgeCenter } from 'react-flow-renderer';

const ParallelEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data,
    markerEnd,
}) => {
    const edgePath = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const { edgeIndex, totalEdges, bandwidth } = data;

    // Calculate offset to separate parallel edges
    // If there's only 1 edge, offset is 0.
    // If multiple, we spread them out.
    // We'll use a simple quadratic bezier offset or just offset the control points if we could, 
    // but getBezierPath returns a string "M... C...". 
    // A simpler hack for visual separation without complex math is to maintain the bezier curve 
    // but shift the central control point? 
    // Actually, standard practice for React Flow parallel edges is often just changing the path data.
    // However, modifying the SVG path string manually is error-prone.

    // Alternative: Use a path offset. 
    // Since we can't easily modify the path string returned by getBezierPath for parallelism 
    // without re-implementing bezier logic, let's try a different approach.
    // We can calculate the center, then offset the control points.

    // Let's implement a custom cubic bezier function to support curvature offset.

    const getCustomPath = () => {
        // Basic offset logic: 
        // 0 -> 0
        // 2 edges -> -10, 10
        // 3 edges -> -20, 0, 20

        if (totalEdges <= 1) return edgePath;

        const curvature = 0.25;
        const spacing = 20;

        // Calculate the middle index (e.g., for 3 edges: 0, 1, 2 -> mid is 1)
        const center = (totalEdges - 1) / 2;
        const offset = (edgeIndex - center) * spacing;

        // We need to calculate a control point that pulls the curve.
        // Since standard Bezier is mostly horizontal in React Flow (Left/Right handles),
        // we offset Y at the midpoint.

        const midpointX = (sourceX + targetX) / 2;
        const midpointY = (sourceY + targetY) / 2;

        // Check orientation
        const isHorizontal = Math.abs(sourceX - targetX) > Math.abs(sourceY - targetY);

        let controlX, controlY;

        if (isHorizontal) {
            controlX = midpointX;
            controlY = midpointY + offset;
        } else {
            controlX = midpointX + offset;
            controlY = midpointY;
        }

        // This is a quadratic bezier for simplicity: M start Q control end
        return `M${sourceX},${sourceY} Q${controlX},${controlY} ${targetX},${targetY}`;
    };

    const path = getCustomPath();

    return (
        <>
            <path
                id={id}
                style={style}
                className="react-flow__edge-path"
                d={path}
                markerEnd={markerEnd}
            />
            {/* Optional: Add a label or invisible hover area if needed */}
        </>
    );
};

export default memo(ParallelEdge);
