// frontend/src/components/Sidebar/GroupEditor.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const GROUP_COLORS = [
    { name: 'Blue', value: '#cfe2ff' },
    { name: 'Green', value: '#d1e7dd' },
    { name: 'Red', value: '#f8d7da' },
    { name: 'Yellow', value: '#fff3cd' },
    { name: 'Cyan', value: '#cff4fc' },
    { name: 'Gray', value: '#e9ecef' }
];

const GROUP_SHAPES = [
    { name: 'sidebar.shapeRoundedRectangle', value: 'rounded-rectangle' },
    { name: 'sidebar.shapeRectangle', value: 'rectangle' },
    { name: 'sidebar.shapeCircle', value: 'circle' }
];


const GroupEditor = ({ selectedElement, onUpdateNodeData, onDeleteNode }) => {
  const [groupLabel, setGroupLabel] = useState('');
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0].value);
  const [groupShape, setGroupShape] = useState(GROUP_SHAPES[0].value);
  const [groupWidth, setGroupWidth] = useState(400);
  const [groupHeight, setGroupHeight] = useState(300);
  const [groupOpacity, setGroupOpacity] = useState(0.6);
  const { t } = useTranslation();

  useEffect(() => {
    if (selectedElement) {
      const { data } = selectedElement;
      setGroupLabel(data.label);
      setGroupColor(data.color);
      setGroupShape(data.shape || GROUP_SHAPES[0].value);
      setGroupWidth(data.width);
      setGroupHeight(data.height);
      setGroupOpacity(data.opacity);
    }
  }, [selectedElement]);
  
  useEffect(() => {
    if (!selectedElement) return;

    const parsedWidth = parseInt(groupWidth, 10);
    const parsedHeight = parseInt(groupHeight, 10);
    const parsedOpacity = parseFloat(groupOpacity);

    if (
        groupLabel === selectedElement.data.label &&
        groupColor === selectedElement.data.color &&
        groupShape === selectedElement.data.shape &&
        parsedWidth === selectedElement.data.width &&
        parsedHeight === selectedElement.data.height &&
        parsedOpacity === selectedElement.data.opacity
    ) {
        return;
    }

    const handler = setTimeout(() => {
      onUpdateNodeData(selectedElement.id, {
        label: groupLabel,
        color: groupColor,
        shape: groupShape,
        width: parsedWidth || 400,
        height: parsedHeight || 300,
        opacity: parsedOpacity
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [groupLabel, groupColor, groupShape, groupWidth, groupHeight, groupOpacity, selectedElement, onUpdateNodeData]);

  if (!selectedElement) return null;

  return (
    <>
      <h3>{t('sidebar.editGroup')}</h3>
      <div className="control-group">
        <label htmlFor="group-label-input">{t('sidebar.groupLabel')}</label>
        <input id="group-label-input" type="text" value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} />
      </div>
      <div className="control-group">
        <label htmlFor="group-color-selector">{t('sidebar.groupColor')}</label>
        <select id="group-color-selector" className="icon-selector" value={groupColor} onChange={(e) => setGroupColor(e.target.value)}>
          {GROUP_COLORS.map(c => <option key={c.value} value={c.value}>{c.name}</option>)}
        </select>
      </div>
       <div className="control-group">
        <label htmlFor="group-shape-selector">{t('sidebar.groupShape')}</label>
        <select id="group-shape-selector" className="icon-selector" value={groupShape} onChange={(e) => setGroupShape(e.target.value)}>
          {GROUP_SHAPES.map(s => <option key={s.value} value={s.value}>{t(s.name)}</option>)}
        </select>
      </div>
      <div className="control-group">
        <label htmlFor="group-width-input">{t('sidebar.width')}</label>
        <input id="group-width-input" type="number" value={groupWidth} onChange={(e) => setGroupWidth(e.target.value)} />
      </div>
      <div className="control-group">
        <label htmlFor="group-height-input">{t('sidebar.height')}</label>
        <input id="group-height-input" type="number" value={groupHeight} onChange={(e) => setGroupHeight(e.target.value)} />
      </div>
      <div className="control-group">
        <label htmlFor="group-opacity-slider">{t('sidebar.opacity')} ({Math.round(groupOpacity * 100)}%)</label>
        <input
          id="group-opacity-slider"
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={groupOpacity}
          onChange={(e) => setGroupOpacity(e.target.value)}
        />
      </div>
      <div className="control-group">
        <button onClick={onDeleteNode} className="danger">{t('sidebar.deleteGroup')}</button>
      </div>
    </>
  );
};

export default GroupEditor;