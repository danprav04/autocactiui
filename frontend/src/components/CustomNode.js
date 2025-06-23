import React, { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';

// Using memo to prevent re-renders of nodes that haven't changed
export default memo(({ data, selected }) => {
  return (
    <div className="custom-node-container">
      <Handle type="target" position={Position.Top} className="custom-handle" />
      <div className={`custom-node-body ${selected ? 'selected' : ''}`}>
        <img src={data.icon} className="node-icon" alt="device icon" />
        <div className="node-label">
          <strong>{data.hostname}</strong>
          <small>{data.ip}</small>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="custom-handle" />
    </div>
  );
});