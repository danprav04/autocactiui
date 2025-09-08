// frontend/src/components/GroupNode.js
import React, { memo } from 'react';

// Using memo to prevent re-renders of nodes that haven't changed
export default memo(({ data, selected }) => {
    const { label, color, width, height } = data;

    // The main container will now handle layout and selection styling.
    const nodeStyle = {
        backgroundColor: color,
        width: `${width}px`,
        height: `${height}px`,
        border: selected ? '2px solid var(--accent-primary)' : '1px dashed var(--node-border)',
    };

    return (
        <div className="group-node" style={nodeStyle}>
            <div className="group-label">{label}</div>
        </div>
    );
});