import React, { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';

// Using memo to prevent re-renders of nodes that haven't changed
export default memo(({ data, selected }) => {
  return (
    // The main container will now handle layout and selection styling
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      {/* Handles are now visually hidden via CSS but still functional */}
      <Handle type="target" position={Position.Top} className="custom-handle" />
      
      <img src={data.icon} className="node-icon" alt={`${data.hostname} icon`} />
      
      <div className="node-label">
        <strong>{data.hostname}</strong>
        <small>{data.ip}</small>
      </div>

      <Handle type="source" position={Position.Bottom} className="custom-handle" />
    </div>
  );
});