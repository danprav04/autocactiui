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

const Sidebar = ({ 
  selectedElement, 
  neighbors, 
  onAddNeighbor, 
  onDeleteNode,
  onUpdateNodeData,
  onUploadMap,
  onAddGroup,
  availableIcons,
  mapName,
  setMapName,
  isMapStarted,
  isUploading,
  cactiInstallations,
  selectedCactiId,
  setSelectedCactiId
}) => {
  // State for device editing
  const [editableHostname, setEditableHostname] = useState('');
  const [editableType, setEditableType] = useState('');

  // State for group editing
  const [groupLabel, setGroupLabel] = useState('');
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0].value);
  const [groupWidth, setGroupWidth] = useState(400);
  const [groupHeight, setGroupHeight] = useState(300);
  const [groupOpacity, setGroupOpacity] = useState(0.6);

  const { t } = useTranslation();

  useEffect(() => {
    if (selectedElement) {
      if (selectedElement.type === 'custom') {
        setEditableHostname(selectedElement.data.hostname);
        const currentType = selectedElement.data.iconType;
        setEditableType(availableIcons.includes(currentType) ? currentType : availableIcons[0]);
      } else if (selectedElement.type === 'group') {
        setGroupLabel(selectedElement.data.label);
        setGroupColor(selectedElement.data.color);
        setGroupWidth(selectedElement.data.width);
        setGroupHeight(selectedElement.data.height);
        setGroupOpacity(selectedElement.data.opacity);
      }
    }
  }, [selectedElement, availableIcons]);

  // Debounced effect for updating device nodes
  useEffect(() => {
    if (!selectedElement || selectedElement.type !== 'custom') return;

    // Prevents running on initial form population
    if (editableHostname === selectedElement.data.hostname && editableType === selectedElement.data.iconType) {
        return;
    }
    
    const handler = setTimeout(() => {
        onUpdateNodeData(selectedElement.id, {
            hostname: editableHostname,
            iconType: editableType
        });
    }, 500); // 500ms debounce delay

    return () => clearTimeout(handler);
  }, [editableHostname, editableType, selectedElement, onUpdateNodeData]);

  // Debounced effect for updating group nodes
  useEffect(() => {
    if (!selectedElement || selectedElement.type !== 'group') return;
    
    const parsedWidth = parseInt(groupWidth, 10);
    const parsedHeight = parseInt(groupHeight, 10);
    const parsedOpacity = parseFloat(groupOpacity);

    // Prevents running on initial form population
    if (
        groupLabel === selectedElement.data.label &&
        groupColor === selectedElement.data.color &&
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
            width: parsedWidth || 400,
            height: parsedHeight || 300,
            opacity: parsedOpacity
        });
    }, 500); // 500ms debounce delay

    return () => clearTimeout(handler);
  }, [groupLabel, groupColor, groupWidth, groupHeight, groupOpacity, selectedElement, onUpdateNodeData]);


  const renderEditForm = () => {
    if (!selectedElement) {
        return (
            <div className="placeholder-message">
                {t('sidebar.placeholderClickNode')}
            </div>
        );
    }

    if (selectedElement.type === 'group') {
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
    }
    
    if (selectedElement.type === 'custom') {
      return (
        <>
            <h3>{t('sidebar.editDevice')}</h3>
            <div className="control-group">
              <label htmlFor="hostname-input">{t('sidebar.hostname')}</label>
              <input id="hostname-input" type="text" value={editableHostname} onChange={(e) => setEditableHostname(e.target.value)} />
            </div>
            <div className="control-group">
              <label htmlFor="ip-display">{t('sidebar.ipAddress')}</label>
              <input id="ip-display" type="text" value={selectedElement.data.ip} disabled={true} />
            </div>
            <div className="control-group">
              <label htmlFor="type-selector">{t('sidebar.deviceType')}</label>
              <select id="type-selector" className="icon-selector" value={editableType} onChange={(e) => setEditableType(e.target.value)}>
                {availableIcons.map(iconName => <option key={iconName} value={iconName}>{iconName}</option>)}
              </select>
            </div>
            <div className="control-group">
              <button onClick={onDeleteNode} className="danger">{t('sidebar.deleteDevice')}</button>
            </div>
            
            <h3>{t('sidebar.availableNeighbors')}</h3>
            {neighbors.length > 0 ? (
                <ul>
                    {neighbors.map(neighbor => (
                        <li key={neighbor.ip}>
                            <span>{neighbor.neighbor}<br/><small>{neighbor.ip}</small></span>
                            <button onClick={() => onAddNeighbor(neighbor)}>{t('sidebar.add')}</button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="no-neighbors-message">{t('sidebar.noNeighbors')}</p>
            )}
        </>
      );
    }
    return null;
  };

  return (
    <div className="sidebar">
      <div>
        <h2>{t('sidebar.controls')}</h2>
        <div className="control-group">
          <label htmlFor="map-name-input">{t('sidebar.mapName')}</label>
          <input id="map-name-input" type="text" value={mapName} onChange={(e) => setMapName(e.target.value)} disabled={!isMapStarted} placeholder={t('sidebar.mapNamePlaceholder')} />
        </div>
        <div className="control-group">
          <label htmlFor="cacti-selector">{t('sidebar.cactiInstall')}</label>
          <select id="cacti-selector" className="icon-selector" value={selectedCactiId} onChange={(e) => setSelectedCactiId(e.target.value)} disabled={!isMapStarted || cactiInstallations.length === 0}>
            {cactiInstallations.length === 0 ? (<option>{t('sidebar.cactiLoading')}</option>) : (
              cactiInstallations.map(inst => <option key={inst.id} value={inst.id}>{inst.hostname} ({inst.ip})</option>)
            )}
          </select>
        </div>
        <div className="control-group">
          <button onClick={onUploadMap} disabled={!isMapStarted || isUploading || !selectedCactiId}>
            {isUploading ? t('sidebar.uploading') : t('sidebar.uploadToCacti')}
          </button>
        </div>
      </div>
      
      <hr />

      {isMapStarted && (
        <div>
            <h3>{t('sidebar.mapTools')}</h3>
            <div className="control-group">
                <button onClick={onAddGroup} className="secondary">{t('sidebar.addGroup')}</button>
            </div>
            <hr />
        </div>
      )}

      {!isMapStarted ? (
        <div className="placeholder-message">{t('sidebar.placeholderStart')}</div>
      ) : (
        <div className="neighbors-section">
            {renderEditForm()}
        </div>
      )}

    </div>
  );
};

export default Sidebar;