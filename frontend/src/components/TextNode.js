// frontend/src/components/TextNode.js
import React, { useState, useEffect, useContext } from 'react';
import { NodeContext } from '../App';

const TextNode = ({ id, data, selected }) => {
    const { onUpdateNodeData } = useContext(NodeContext);
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(data.text);

    useEffect(() => {
        setText(data.text);
    }, [data.text]);

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleChange = (e) => {
        setText(e.target.value);
    };

    const handleBlur = () => {
        onUpdateNodeData(id, { text });
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleBlur();
        }
    };
    
    const nodeStyle = {
        color: data.color,
        fontSize: `${data.fontSize}px`,
        width: 'auto',
        height: 'auto',
    };

    return (
        <div className={`text-node ${selected ? 'selected' : ''}`} style={nodeStyle} onDoubleClick={handleDoubleClick}>
            {isEditing ? (
                <textarea
                    value={text}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="text-node-input"
                    style={{ fontSize: `${data.fontSize}px`, color: data.color }}
                    autoFocus
                />
            ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                    {data.text || '...'}
                </div>
            )}
        </div>
    );
};

export default React.memo(TextNode);