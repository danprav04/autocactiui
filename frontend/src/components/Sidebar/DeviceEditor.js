// frontend/src/components/Sidebar/DeviceEditor.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import NeighborsList from './NeighborsList';

const DeviceEditor = ({
  selectedElement,
  onDeleteElements,
  neighbors,
  onAddNeighbor,
}) => {
  const { t } = useTranslation();

  if (!selectedElement) return null;

  const isEndDevice = !selectedElement.data.ip;

  return (
    <>
      <div className="control-group">
        <button onClick={onDeleteElements} className="danger">
          {t('sidebar.deleteDevice')}
        </button>
      </div>
      {!isEndDevice && <NeighborsList neighbors={neighbors} onAddNeighbor={onAddNeighbor} />}
    </>
  );
};

export default DeviceEditor;