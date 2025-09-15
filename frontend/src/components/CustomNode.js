import React, { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';

// This style object positions the handle in the absolute center of the node
// and makes it invisible, so edges appear to connect to the node's center.
const handleStyle = {
  width: '1px',
  height: '1px',
  background: 'transparent',
  border: 'none',
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};


// Using memo to prevent re-renders of nodes that haven't changed
export default memo(({ data, selected }) => {
  return (
    // The main container will now handle layout and selection styling.
    // We add position: 'relative' to serve as the positioning context for the handles.
    <div className={`custom-node ${selected ? 'selected' : ''} ${data.isPreview ? 'preview' : ''}`} style={{ position: 'relative' }}>
      {/* Both source and target handles are placed in the center. */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      
      <img src={data.icon} className="node-icon" alt={`${data.hostname} icon`} />
      
      <div className="node-label">
        <strong>{data.hostname}</strong>
        <small>{data.ip}</small>
      </div>
    </div>
  );
});