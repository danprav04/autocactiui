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
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const { t } = useTranslation();

  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm(""); // Reset search when popup opens
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filteredNeighbors = neighbors.filter(
    (n) =>
      n.neighbor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.ip.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                {filteredNeighbors.map((neighbor) => (
                  <li
                    key={neighbor.ip + neighbor.interface}
                    className="neighbor-item"
                  >
                    <div className="neighbor-info">
                      <strong>{neighbor.neighbor}</strong>
                      <small>{neighbor.ip}</small>
                    </div>
                    <button
                      className="add-neighbor-button"
                      onClick={() => onAddNeighbor(neighbor)}
                    >
                      {t("sidebar.add")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-results">{t("neighborsPopup.noResults")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NeighborsPopup;
