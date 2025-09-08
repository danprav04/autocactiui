// frontend/src/components/Sidebar/DeviceEditor.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import NeighborsList from './NeighborsList';

const DeviceEditor = ({
  selectedElement,
  onUpdateNodeData,
  onDeleteNode,
  availableIcons,
  neighbors,
  onAddNeighbor,
}) => {
  const [editableHostname, setEditableHostname] = useState('');
  const [editableType, setEditableType] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (selectedElement) {
      setEditableHostname(selectedElement.data.hostname);
      const currentType = selectedElement.data.iconType;
      setEditableType(availableIcons.includes(currentType) ? currentType : availableIcons[0]);
    }
  }, [selectedElement, availableIcons]);

  useEffect(() => {
    if (!selectedElement) return;

    if (editableHostname === selectedElement.data.hostname && editableType === selectedElement.data.iconType) {
      return;
    }

    const handler = setTimeout(() => {
      onUpdateNodeData(selectedElement.id, {
        hostname: editableHostname,
        iconType: editableType,
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [editableHostname, editableType, selectedElement, onUpdateNodeData]);

  if (!selectedElement) return null;

  return (
    <>
      <h3>{t('sidebar.editDevice')}</h3>
      <div className="control-group">
        <label htmlFor="hostname-input">{t('sidebar.hostname')}</label>
        <input
          id="hostname-input"
          type="text"
          value={editableHostname}
          onChange={(e) => setEditableHostname(e.target.value)}
        />
      </div>
      <div className="control-group">
        <label htmlFor="ip-display">{t('sidebar.ipAddress')}</label>
        <input id="ip-display" type="text" value={selectedElement.data.ip} disabled={true} />
      </div>
      <div className="control-group">
        <label htmlFor="type-selector">{t('sidebar.deviceType')}</label>
        <select
          id="type-selector"
          className="icon-selector"
          value={editableType}
          onChange={(e) => setEditableType(e.target.value)}
        >
          {availableIcons.map((iconName) => (
            <option key={iconName} value={iconName}>
              {iconName}
            </option>
          ))}
        </select>
      </div>
      <div className="control-group">
        <button onClick={onDeleteNode} className="danger">
          {t('sidebar.deleteDevice')}
        </button>
      </div>
      <NeighborsList neighbors={neighbors} onAddNeighbor={onAddNeighbor} />
    </>
  );
};

export default DeviceEditor;