// frontend/src/components/Sidebar/NeighborsList.js
import React from 'react';
import { useTranslation } from 'react-i18next';

const NeighborsList = ({ neighbors, onAddNeighbor }) => {
  const { t } = useTranslation();

  return (
    <>
      <h3>{t('sidebar.availableNeighbors')}</h3>
      {neighbors.length > 0 ? (
        <ul>
          {neighbors.map((neighbor) => (
            <li key={neighbor.ip}>
              <span>
                {neighbor.neighbor}
                <br />
                <small>{neighbor.ip}</small>
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