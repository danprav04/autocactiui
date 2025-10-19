// frontend/src/components/Startup/StartupScreen.js
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_ICON_NAME } from '../../config/constants';

const StartupScreen = ({ onStart, isLoading, availableIcons, onImportConfig }) => {
    const initialIpRef = useRef(null);
    const importInputRef = useRef(null);
    const [initialIconName, setInitialIconName] = useState(INITIAL_ICON_NAME);
    const { t } = useTranslation();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (initialIpRef.current) {
            onStart(initialIpRef.current.value, initialIconName);
        }
    };

    const handleImportClick = () => {
        importInputRef.current.click();
    };

    const handleFileImport = (event) => {
        const file = event.target.files[0];
        if (file) {
            onImportConfig(file);
        }
        // Reset the input value to allow importing the same file again
        event.target.value = null;
    };

    return (
        <div className="start-container">
            <h1>{t('startup.title')}</h1>
            <div className="start-form">
                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <input
                        type="text"
                        ref={initialIpRef}
                        placeholder={t('startup.placeholderIp')}
                        defaultValue="10.10.1.3"
                    />
                    <select 
                        className="icon-selector"
                        value={initialIconName} 
                        onChange={(e) => setInitialIconName(e.target.value)}
                        style={{width: '100%', marginBottom: '20px', textAlign: 'center'}}
                    >
                        {availableIcons.map(iconName => (
                            <option key={iconName} value={iconName}>
                                {t('startup.iconSelector', { iconName })}
                            </option>
                        ))}
                    </select>

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? t('startup.loading') : t('startup.startMapping')}
                    </button>
                </form>

                <div className="startup-separator">{t('startup.or')}</div>

                <input
                    type="file"
                    ref={importInputRef}
                    onChange={handleFileImport}
                    style={{ display: 'none' }}
                    accept=".json"
                />
                <button type="button" onClick={handleImportClick} className="secondary" disabled={isLoading}>
                    {t('startup.importAction')}
                </button>
            </div>
        </div>
    );
};

export default StartupScreen;