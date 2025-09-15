// frontend/src/components/TopToolbar/TopToolbar.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// --- ICONS ---
const AlignLeftIcon = () => <svg viewBox="0 0 24 24"><path d="M15 21v-4h2v4h-2zm-4 0v-8h2v8h-2zm-4 0v-6h2v6H7zM3 3v16h2V3H3z"/></svg>;
const AlignHCenterIcon = () => <svg viewBox="0 0 24 24"><path d="M11 2v4h2V2h-2zm-4 6v10h2V8H7zm8 0v10h2V8h-2zM3 2v4h2V2H3zm16 0v4h2V2h-2z"/></svg>;
const AlignRightIcon = () => <svg viewBox="0 0 24 24"><path d="M7 21v-4h2v4H7zm4 0v-8h2v8h-2zm4 0v-6h2v6h-2zM19 3v16h2V3h-2z"/></svg>;
const AlignTopIcon = () => <svg viewBox="0 0 24 24" transform="rotate(90 12 12)"><path d="M15 21v-4h2v4h-2zm-4 0v-8h2v8h-2zm-4 0v-6h2v6H7zM3 3v16h2V3H3z"/></svg>;
const AlignVCenterIcon = () => <svg viewBox="0 0 24 24" transform="rotate(90 12 12)"><path d="M11 2v4h2V2h-2zm-4 6v10h2V8H7zm8 0v10h2V8h-2zM3 2v4h2V2H3zm16 0v4h2V2h-2z"/></svg>;
const AlignBottomIcon = () => <svg viewBox="0 0 24 24" transform="rotate(90 12 12)"><path d="M7 21v-4h2v4H7zm4 0v-8h2v8h-2zm4 0v-6h2v6h-2zM19 3v16h2V3h-2z"/></svg>;


// --- SUB-COMPONENTS ---

const useDebouncedUpdater = (selectedElement, onUpdateNodeData) => {
    const [localData, setLocalData] = useState(selectedElement.data);
    
    useEffect(() => {
      setLocalData(selectedElement.data);
    }, [selectedElement]);
  
    useEffect(() => {
      if (JSON.stringify(localData) === JSON.stringify(selectedElement.data)) return;
      const handler = setTimeout(() => {
          onUpdateNodeData(selectedElement.id, localData);
      }, 500);
      return () => clearTimeout(handler);
    }, [localData, selectedElement, onUpdateNodeData]);

    const handleChange = (e) => {
      const { id, value, type } = e.target;
      const parsedValue = type === 'number' || type === 'range' ? parseFloat(value) : value;
      setLocalData(prev => ({ ...prev, [id]: parsedValue }));
    };

    return [localData, handleChange];
};


const DeviceProperties = ({ node, onUpdateNodeData, availableIcons }) => {
    const { t } = useTranslation();
    const [localData, handleChange] = useDebouncedUpdater(node, onUpdateNodeData);

    return (
        <>
            <div className="toolbar-group">
                <label htmlFor="hostname">{t('sidebar.hostname')}</label>
                <input id="hostname" type="text" value={localData.hostname || ''} onChange={handleChange} style={{width: '160px'}}/>
            </div>
            <div className="toolbar-group">
                <label>{t('sidebar.ipAddress')}</label>
                <input type="text" value={node.data.ip} disabled={true} style={{width: '120px'}}/>
            </div>
            <div className="toolbar-group">
                <label htmlFor="iconType">{t('sidebar.deviceType')}</label>
                <select id="iconType" value={localData.iconType} onChange={handleChange}>
                    {availableIcons.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>
        </>
    );
};

const GroupProperties = ({ node, onUpdateNodeData }) => {
    const { t } = useTranslation();
    const [localData, handleChange] = useDebouncedUpdater(node, onUpdateNodeData);

    return (
        <>
            <div className="toolbar-group">
                <label htmlFor="label">{t('sidebar.groupLabel')}</label>
                <input id="label" type="text" value={localData.label || ''} onChange={handleChange} style={{width: '150px'}} />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label htmlFor="color">{t('sidebar.groupColor')}</label>
                <input id="color" type="color" value={localData.color} onChange={handleChange} />
            </div>
            <div className="toolbar-group">
                <label htmlFor="opacity">{t('sidebar.opacity')}</label>
                <input id="opacity" type="range" min="0.1" max="1" step="0.05" value={localData.opacity} onChange={handleChange} />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label htmlFor="width">{t('sidebar.width')}</label>
                <input id="width" type="number" value={localData.width} onChange={handleChange} />
            </div>
             <div className="toolbar-group">
                <label htmlFor="height">{t('sidebar.height')}</label>
                <input id="height" type="number" value={localData.height} onChange={handleChange} />
            </div>
        </>
    );
};

const TextProperties = ({ node, onUpdateNodeData }) => {
    const { t } = useTranslation();
    const [localData, handleChange] = useDebouncedUpdater(node, onUpdateNodeData);
    
    return (
         <>
            <div className="toolbar-group">
                <label htmlFor="text">{t('sidebar.textContent')}</label>
                <input id="text" type="text" value={localData.text || ''} onChange={handleChange} style={{width: '200px'}} />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label htmlFor="fontSize">{t('sidebar.fontSize')}</label>
                <input id="fontSize" type="number" min="8" max="128" value={localData.fontSize} onChange={handleChange} />
            </div>
            <div className="toolbar-group">
                <label htmlFor="color">{t('sidebar.textColor')}</label>
                <input id="color" type="color" value={localData.color} onChange={handleChange} />
            </div>
        </>
    );
};

const MultiSelectTools = ({ count, alignElements, distributeElements }) => {
    const { t } = useTranslation();
    return (
        <>
            <span className='toolbar-info-text'>{t('sidebar.multiSelectTitle')} ({count})</span>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label>{t('sidebar.align')}</label>
                <button onClick={() => alignElements('left')} title={t('sidebar.alignLeft')}><AlignLeftIcon /></button>
                <button onClick={() => alignElements('h-center')} title={t('sidebar.alignHCenter')}><AlignHCenterIcon /></button>
                <button onClick={() => alignElements('right')} title={t('sidebar.alignRight')}><AlignRightIcon /></button>
                <button onClick={() => alignElements('top')} title={t('sidebar.alignTop')}><AlignTopIcon /></button>
                <button onClick={() => alignElements('v-center')} title={t('sidebar.alignVCenter')}><AlignVCenterIcon /></button>
                <button onClick={() => alignElements('bottom')} title={t('sidebar.alignBottom')}><AlignBottomIcon /></button>
            </div>
            {count > 2 && (
                <>
                    <div className="toolbar-separator" />
                    <div className="toolbar-group">
                        <label>{t('sidebar.distribute')}</label>
                        <button onClick={() => distributeElements('horizontal')} title={t('sidebar.distributeH')}>H</button>
                        <button onClick={() => distributeElements('vertical')} title={t('sidebar.distributeV')}>V</button>
                    </div>
                </>
            )}
        </>
    );
};

// --- MAIN COMPONENT ---

const TopToolbar = ({ selectedElements, onUpdateNodeData, alignElements, distributeElements, availableIcons }) => {
    if (selectedElements.length === 0) return null;

    const renderContent = () => {
        if (selectedElements.length > 1) {
            return (
                <MultiSelectTools
                    count={selectedElements.length}
                    alignElements={alignElements}
                    distributeElements={distributeElements}
                />
            );
        }

        const selected = selectedElements[0];
        switch (selected.type) {
            case 'custom':
                return <DeviceProperties node={selected} onUpdateNodeData={onUpdateNodeData} availableIcons={availableIcons} />;
            case 'group':
                return <GroupProperties node={selected} onUpdateNodeData={onUpdateNodeData} />;
            case 'text':
                return <TextProperties node={selected} onUpdateNodeData={onUpdateNodeData} />;
            default:
                return null;
        }
    };

    return (
        <div className="top-toolbar">
            {renderContent()}
        </div>
    );
};

export default TopToolbar;