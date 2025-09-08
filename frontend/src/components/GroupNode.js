// frontend/src/components/GroupNode.js
import React, { memo, useState, useEffect, useRef, useContext } from 'react';
import { NodeContext } from '../App';

export default memo(({ id, data, selected, xPos, yPos }) => {
    const { onUpdateNodeData } = useContext(NodeContext);
    const { label, color, width, height, opacity } = data;
    
    const [isEditing, setIsEditing] = useState(false);
    const [labelText, setLabelText] = useState(label);
    const nodeRef = useRef(null);

    // Update local label state if the parent data changes
    useEffect(() => {
        setLabelText(label);
    }, [label]);

    const handleLabelDoubleClick = (e) => {
        e.stopPropagation(); // Prevent drag from starting
        setIsEditing(true);
    };

    const handleLabelChange = (e) => {
        setLabelText(e.target.value);
    };

    const handleLabelUpdate = () => {
        onUpdateNodeData(id, { label: labelText });
        setIsEditing(false);
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleLabelUpdate();
        } else if (e.key === 'Escape') {
            setLabelText(label); // Revert changes
            setIsEditing(false);
        }
    };

    const onResizeStart = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const doDrag = (e) => {
            const newWidth = startWidth + e.clientX - startX;
            const newHeight = startHeight + e.clientY - startY;
            // Update node data with new dimensions, enforcing a minimum size
            onUpdateNodeData(id, { width: Math.max(newWidth, 100), height: Math.max(newHeight, 80) });
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag, false);
            document.removeEventListener('mouseup', stopDrag, false);
        };

        document.addEventListener('mousemove', doDrag, false);
        document.addEventListener('mouseup', stopDrag, false);
    };
    
    const nodeStyle = {
        backgroundColor: color,
        opacity: opacity,
        width: `${width}px`,
        height: `${height}px`,
        border: selected ? '2px solid var(--accent-primary)' : '1px dashed var(--node-border)',
    };

    return (
        <div ref={nodeRef} className="group-node" style={nodeStyle}>
            {isEditing ? (
                <input
                    type="text"
                    value={labelText}
                    onChange={handleLabelChange}
                    onBlur={handleLabelUpdate}
                    onKeyDown={handleInputKeyDown}
                    className="group-label-input"
                    autoFocus
                    onClick={(e) => e.stopPropagation()} // Prevent deselection
                />
            ) : (
                <div className="group-label" onDoubleClick={handleLabelDoubleClick}>
                    {label}
                </div>
            )}
            <div 
                className="group-resizer" 
                onMouseDown={onResizeStart}
            />
        </div>
    );
});