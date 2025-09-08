// frontend/src/components/GroupNode.js
import React, { memo, useState, useEffect, useRef, useContext } from 'react';
import { useViewport } from 'react-flow-renderer';
import { NodeContext } from '../App';

// A more intuitive SVG icon for resizing
const ResizerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M20 20H4v-4h2v2h12v-2h2v4zM4 4h16v4h-2V6H6v2H4V4z" transform="rotate(-45 12 12)" />
    </svg>
);


export default memo(({ id, data, selected }) => {
    const { onUpdateNodeData } = useContext(NodeContext);
    const { label, color, width, height, opacity } = data;
    const { zoom } = useViewport();
    
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
        // No need for stopPropagation as the 'nodrag' class handles it.
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const doDrag = (e) => {
            const newWidth = startWidth + (e.clientX - startX) / zoom;
            const newHeight = startHeight + (e.clientY - startY) / zoom;
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
                    className="group-label-input nodrag" // Add nodrag here as well
                    autoFocus
                    onClick={(e) => e.stopPropagation()} // Prevent deselection
                />
            ) : (
                <div className="group-label" onDoubleClick={handleLabelDoubleClick}>
                    {label}
                </div>
            )}
            <div 
                // The 'nodrag' class is crucial to prevent the node from moving
                // when the user intends to resize.
                className="group-resizer nodrag" 
                onMouseDown={onResizeStart}
            >
                <ResizerIcon />
            </div>
        </div>
    );
});