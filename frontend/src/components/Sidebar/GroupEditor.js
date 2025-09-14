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
    { name: 'sidebar.shapeCircle', value: 'circle' },
    { name: 'sidebar.shapeTriangle', value: 'triangle' }
];

const BORDER_STYLES = [
    { name: 'sidebar.borderSolid', value: 'solid' },
    { name: 'sidebar.borderDashed', value: 'dashed' },
];

const GroupEditor = ({ selectedElement, onUpdateNodeData, onDeleteElements }) => {
  const [groupData, setGroupData] = useState({});
  const { t } = useTranslation();

  // This effect now correctly syncs the local state when the selected element's data changes
  // from an external source, like resizing the node on the map canvas.
  useEffect(() => {
    if (selectedElement) {
      setGroupData({
        label: selectedElement.data.label,
        color: selectedElement.data.color,
        shape: selectedElement.data.shape || GROUP_SHAPES[0].value,
        width: selectedElement.data.width,
        height: selectedElement.data.height,
        opacity: selectedElement.data.opacity,
        borderColor: selectedElement.data.borderColor || '#8a8d91',
        borderStyle: selectedElement.data.borderStyle || 'dashed',
        borderWidth: selectedElement.data.borderWidth || 1,
      });
    }
  }, [selectedElement]); // Dependency changed to the whole object.
  
  // This effect pushes changes from the editor back to the global state.
  useEffect(() => {
    if (!selectedElement || !Object.keys(groupData).length) return;

    // A deep-enough comparison to prevent updating global state
    // if the props already match the local state. This breaks update loops
    // and prevents overwriting external changes with stale local state.
    const hasChanged =
      selectedElement.data.label !== groupData.label ||
      selectedElement.data.color !== groupData.color ||
      (selectedElement.data.shape || GROUP_SHAPES[0].value) !== groupData.shape ||
      parseInt(selectedElement.data.width, 10) !== parseInt(groupData.width, 10) ||
      parseInt(selectedElement.data.height, 10) !== parseInt(groupData.height, 10) ||
      parseFloat(selectedElement.data.opacity) !== parseFloat(groupData.opacity) ||
      (selectedElement.data.borderColor || '#8a8d91') !== groupData.borderColor ||
      (selectedElement.data.borderStyle || 'dashed') !== groupData.borderStyle ||
      (selectedElement.data.borderWidth || 1) !== parseInt(groupData.borderWidth, 10);

    if (!hasChanged) {
        return;
    }

    const handler = setTimeout(() => {
      onUpdateNodeData(selectedElement.id, {
        ...groupData,
        width: parseInt(groupData.width, 10) || 400,
        height: parseInt(groupData.height, 10) || 300,
        opacity: parseFloat(groupData.opacity),
        borderWidth: parseInt(groupData.borderWidth, 10) || 1,
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [groupData, selectedElement, onUpdateNodeData]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setGroupData(prev => ({...prev, [id]: value}));
  };

  if (!selectedElement || !Object.keys(groupData).length) return null;

  return (
    <>
      <h3>{t('sidebar.editGroup')}</h3>
      <div className="control-group">
        <label htmlFor="label">{t('sidebar.groupLabel')}</label>
        <input id="label" type="text" value={groupData.label} onChange={handleChange} />
      </div>
      <div className="control-group">
        <label htmlFor="color">{t('sidebar.groupColor')}</label>
        <select id="color" className="icon-selector" value={groupData.color} onChange={handleChange}>
          {GROUP_COLORS.map(c => <option key={c.value} value={c.value}>{c.name}</option>)}
        </select>
      </div>
       <div className="control-group">
        <label htmlFor="shape">{t('sidebar.groupShape')}</label>
        <select id="shape" className="icon-selector" value={groupData.shape} onChange={handleChange}>
          {GROUP_SHAPES.map(s => <option key={s.value} value={s.value}>{t(s.name)}</option>)}
        </select>
      </div>
      <div className="control-group">
        <label htmlFor="width">{t('sidebar.width')}</label>
        <input id="width" type="number" value={groupData.width} onChange={handleChange} />
      </div>
      <div className="control-group">
        <label htmlFor="height">{t('sidebar.height')}</label>
        <input id="height" type="number" value={groupData.height} onChange={handleChange} />
      </div>
      <div className="control-group">
        <label htmlFor="opacity">{t('sidebar.opacity')} ({Math.round(groupData.opacity * 100)}%)</label>
        <input
          id="opacity"
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={groupData.opacity}
          onChange={handleChange}
        />
      </div>
      <hr />
      <h3>{t('sidebar.borderTitle')}</h3>
       <div className="control-group">
        <label htmlFor="borderStyle">{t('sidebar.borderStyle')}</label>
        <select id="borderStyle" className="icon-selector" value={groupData.borderStyle} onChange={handleChange}>
          {BORDER_STYLES.map(s => <option key={s.value} value={s.value}>{t(s.name)}</option>)}
        </select>
      </div>
       <div className="control-group">
        <label htmlFor="borderColor">{t('sidebar.borderColor')}</label>
        <input id="borderColor" type="color" value={groupData.borderColor} onChange={handleChange} />
      </div>
       <div className="control-group">
        <label htmlFor="borderWidth">{t('sidebar.borderWidth')}</label>
        <input id="borderWidth" type="number" min="1" max="20" value={groupData.borderWidth} onChange={handleChange} />
      </div>

      <hr />
      <div className="control-group">
        <button onClick={onDeleteElements} className="danger">{t('sidebar.deleteGroup')}</button>
      </div>
    </>
  );
};

export default GroupEditor;