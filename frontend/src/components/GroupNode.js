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
    const { label, color, width, height, opacity, shape, borderColor, borderStyle, borderWidth } = data;
    const { zoom } = useViewport();
    
    const [isEditing, setIsEditing] = useState(false);
    const [labelText, setLabelText] = useState(label);
    const nodeRef = useRef(null);
    const lastDimensions = useRef(null);

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
        
        lastDimensions.current = { width: startWidth, height: startHeight };

        const doDrag = (dragEvent) => {
            let newWidth = startWidth + (dragEvent.clientX - startX) / zoom;
            let newHeight = startHeight + (dragEvent.clientY - startY) / zoom;

            if (dragEvent.altKey) {
                // Force a 1:1 aspect ratio (square/circle) by using the larger dimension for both.
                const side = Math.max(newWidth, newHeight);
                newWidth = side;
                newHeight = side;
            }
            
            const finalDimensions = {
                width: Math.max(newWidth, 100),
                height: Math.max(newHeight, 80)
            };

            lastDimensions.current = finalDimensions;
            // Perform a "live" update that doesn't save to the undo/redo history
            onUpdateNodeData(id, finalDimensions, false);
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag, false);
            document.removeEventListener('mouseup', stopDrag, false);
            // On mouse up, perform a final update that IS saved to history
            if(lastDimensions.current) {
                onUpdateNodeData(id, lastDimensions.current, true);
            }
        };

        document.addEventListener('mousemove', doDrag, false);
        document.addEventListener('mouseup', stopDrag, false);
    };
    
    const getShapeStyle = () => {
        switch(shape) {
            case 'circle':
                return { borderRadius: '50%' };
            case 'triangle':
                return { 
                    clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                    borderRadius: '0px' 
                };
            case 'rounded-rectangle':
            default:
                return { borderRadius: '8px' };
        }
    }

    const isTriangle = shape === 'triangle';

    const nodeStyle = {
        backgroundColor: color,
        opacity: opacity,
        width: `${width}px`,
        height: `${height}px`,
        border: `${borderWidth}px ${borderStyle} ${selected ? 'var(--accent-primary)' : borderColor}`,
        ...getShapeStyle(),
        justifyContent: isTriangle ? 'center' : 'flex-start',
    };

    const labelContainerStyle = isTriangle ? {
        paddingTop: `${height * 0.1}px`
    } : {};

    return (
        <div ref={nodeRef} className="group-node" style={nodeStyle}>
            <div style={labelContainerStyle}>
                {isEditing ? (
                    <input
                        type="text"
                        value={labelText}
                        onChange={handleLabelChange}
                        onBlur={handleLabelUpdate}
                        onKeyDown={handleInputKeyDown}
                        className="group-label-input nodrag"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div className="group-label" onDoubleClick={handleLabelDoubleClick}>
                        {label}
                    </div>
                )}
            </div>
            <div 
                className="group-resizer nodrag" 
                onMouseDown={onResizeStart}
            >
                <ResizerIcon />
            </div>
        </div>
    );
});