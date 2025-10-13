// frontend/src/components/Sidebar/NeighborsList.js
import React from 'react';
import { useTranslation } from 'react-i18next';

const NeighborsList = ({ neighbors, onAddNeighbor }) => {
  const { t } = useTranslation();

  // If there are more than 10 neighbors, the popup will be shown.
  // This message clarifies why the list isn't rendered in the sidebar.
  if (neighbors.length > 1) {
    return (
      <>
        <h3>{t('sidebar.availableNeighbors')}</h3>
        <p className="no-neighbors-message">{t('sidebar.tooManyNeighbors', { count: neighbors.length })}</p>
      </>
    );
  }

  return (
    <>
      <h3>{t('sidebar.availableNeighbors')}</h3>
      {neighbors.length > 0 ? (
        <ul>
          {neighbors.map((neighbor) => (
            <li key={neighbor.neighbor + neighbor.interface}>
              <span>
                {neighbor.neighbor}
                <br />
                <small>{neighbor.ip || t('sidebar.endDeviceIdentifier')}</small>
              </span>
              <button onClick={() => onAddNeighbor(neighbor)}>{t('sidebar.add')}</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-neighbors-message">{t('sidebar.noNeighbors')}</p>
      )}
    </>
  );
};

export default NeighborsList;