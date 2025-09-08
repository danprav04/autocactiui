// frontend/src/components/Startup/StartupScreen.js
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_ICON_NAME } from '../../config/constants';

const StartupScreen = ({ onStart, isLoading, availableIcons }) => {
    const initialIpRef = useRef(null);
    const [initialIconName, setInitialIconName] = useState(INITIAL_ICON_NAME);
    const { t } = useTranslation();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (initialIpRef.current) {
            onStart(initialIpRef.current.value, initialIconName);
        }
    };

    return (
        <div className="start-container">
            <h1>{t('startup.title')}</h1>
            <form className="start-form" onSubmit={handleSubmit}>
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
                    style={{width: '320px', marginBottom: '20px', textAlign: 'center'}}
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
        </div>
    );
};

export default StartupScreen;