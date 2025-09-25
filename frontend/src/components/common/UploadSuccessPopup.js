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
            </div>
        </div>
    );
};

export default UploadSuccessPopup;