// frontend/src/components/Sidebar/TextEditor.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const TextEditor = ({ selectedElement, onUpdateNodeData, onDeleteElements }) => {
    const [textData, setTextData] = useState({});
    const { t } = useTranslation();

    useEffect(() => {
        if (selectedElement) {
            setTextData({
                text: selectedElement.data.text,
                fontSize: selectedElement.data.fontSize,
                color: selectedElement.data.color,
            });
        }
    }, [selectedElement?.id]); // Changed dependency to prevent self-revert
    
    useEffect(() => {
        if (!selectedElement || !Object.keys(textData).length) return;

        // Do not trigger update if the values are the same as the prop
        const hasChanged = textData.text !== selectedElement.data.text ||
                           parseInt(textData.fontSize) !== selectedElement.data.fontSize ||
                           textData.color !== selectedElement.data.color;

        if (!hasChanged) return;

        const handler = setTimeout(() => {
            onUpdateNodeData(selectedElement.id, {
                ...textData,
                fontSize: parseInt(textData.fontSize, 10) || 16,
            });
        }, 500);

        return () => clearTimeout(handler);
    }, [textData, selectedElement, onUpdateNodeData]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setTextData(prev => ({ ...prev, [id]: value }));
    };

    if (!selectedElement || !Object.keys(textData).length) return null;

    return (
        <>
            <h3>{t('sidebar.editText')}</h3>
            <div className="control-group">
                <label htmlFor="text">{t('sidebar.textContent')}</label>
                <textarea
                    id="text"
                    rows="4"
                    value={textData.text}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
            </div>
            <div className="control-group">
                <label htmlFor="fontSize">{t('sidebar.fontSize')}</label>
                <input
                    id="fontSize"
                    type="number"
                    min="8"
                    max="128"
                    value={textData.fontSize}
                    onChange={handleChange}
                />
            </div>
            <div className="control-group">
                <label htmlFor="color">{t('sidebar.textColor')}</label>
                <input
                    id="color"
                    type="color"
                    value={textData.color}
                    onChange={handleChange}
                />
            </div>
            <hr />
            <div className="control-group">
                <button onClick={onDeleteElements} className="danger">{t('sidebar.deleteText')}</button>
            </div>
        </>
    );
};

export default TextEditor;