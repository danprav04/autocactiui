// frontend/src/components/common/NeighborsPopup.js
import React from "react";
import { useTranslation } from "react-i18next";
import "./NeighborsPopup.css";

const SearchIcon = () => (
  <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
      clipRule="evenodd"
    />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M18 6L6 18M6 6L18 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NeighborsPopup = ({
  isOpen,
  neighbors,
  sourceHostname,
  onAddNeighbor,
  onAddAllNeighbors,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const { t } = useTranslation();

  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const groupedNeighbors = React.useMemo(() => {
    const neighborMap = new Map();
    neighbors.forEach(neighbor => {
      const key = neighbor.ip || neighbor.neighbor;
      if (!neighborMap.has(key)) {
        neighborMap.set(key, {
          ...neighbor,
          links: [neighbor]
        });
      } else {
        neighborMap.get(key).links.push(neighbor);
      }
    });
    return Array.from(neighborMap.values());
  }, [neighbors]);

  const filteredNeighbors = React.useMemo(() => 
    groupedNeighbors.filter(
      (n) =>
        n.neighbor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.ip && n.ip.toLowerCase().includes(searchTerm.toLowerCase()))
    ), 
  [groupedNeighbors, searchTerm]);


  if (!isOpen) {
    return null;
  }

  const handleAddAllClick = () => {
      if(filteredNeighbors.length > 0) {
          onAddAllNeighbors(filteredNeighbors);
      }
  };

  return (
    <div className="neighbor-popup-overlay" onClick={onClose}>
      <div
        className="neighbor-popup-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="neighbor-popup-close-button"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
        <div className="neighbor-popup-header">
          <h2>{t("neighborsPopup.title", { hostname: sourceHostname })}</h2>
          <p>{t("neighborsPopup.subtitle", { count: neighbors.length })}</p>

          <div className="search-bar">
            <SearchIcon />
            <input
              type="text"
              placeholder={t("neighborsPopup.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="neighbor-popup-body">
          <div className="neighbor-grid-panel">
            {filteredNeighbors.length > 0 ? (
              <ul className="neighbor-grid">
                {filteredNeighbors.map((group) => (
                  <li
                    key={group.ip + group.neighbor}
                    className="neighbor-item"
                  >
                    <div className="neighbor-info">
                      <strong>{group.neighbor}</strong>
                      <small>{group.ip || ' '}</small>
                      {group.links.length > 1 && (
                        <small style={{ fontWeight: 'bold' }}>
                          {t('neighborsPopup.multipleLinks', { count: group.links.length })}
                        </small>
                      )}
                    </div>
                    <button
                      className="add-neighbor-button"
                      onClick={() => onAddNeighbor(group)}
                    >
                      {t("sidebar.add")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-results">
                <span className="no-results-text">
                  {t("neighborsPopup.noResults")}
                </span>
              </div>
            )}
          </div>
            {filteredNeighbors.length > 1 && (
                <div style={{ flexShrink: 0, paddingTop: '16px', borderTop: '1px solid var(--border-color)', marginTop: '16px' }}>
                    <button className="add-neighbor-button" onClick={handleAddAllClick}>
                       {t('neighborsPopup.addAll', { count: filteredNeighbors.length })}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default NeighborsPopup;