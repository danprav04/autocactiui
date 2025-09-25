// frontend/src/components/common/UploadSuccessPopup.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import './UploadSuccessPopup.css';

const UploadSuccessPopup = ({ data, onClose }) => {
    const { t } = useTranslation();

    if (!data) return null;

    // The backend now provides the final URL in the 'message' field upon success
    const mapUrl = data.message;

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                <div className="success-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="currentColor" fillOpacity="0.1"/>
                        <path d="M8 12.5L10.5 15L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <h2>{t('app.uploadSuccessTitle')}</h2>
                <p>{t('app.uploadSuccessMessage')}</p>
                <div className="popup-actions">
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="popup-button primary" onClick={onClose}>
                        {t('app.goToMap')}
                    </a>
                    <button onClick={onClose} className="popup-button secondary">
                        {t('app.close')}
                    </button>
                </div>
                <button className="close-button" onClick={onClose} aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default UploadSuccessPopup;