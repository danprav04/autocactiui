// frontend/src/components/Startup/StartupScreen.js
import React, { useRef, useState } from 'react';
import { INITIAL_ICON_NAME } from '../../config/constants';

const StartupScreen = ({ onStart, isLoading, availableIcons }) => {
    const initialIpRef = useRef(null);
    const [initialIconName, setInitialIconName] = useState(INITIAL_ICON_NAME);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (initialIpRef.current) {
            onStart(initialIpRef.current.value, initialIconName);
        }
    };

    return (
        <div className="start-container">
            <h1>Interactive Network Map Creator</h1>
            <form className="start-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    ref={initialIpRef}
                    placeholder="Enter starting device IP"
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
                            Use icon: {iconName}
                        </option>
                    ))}
                </select>

                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Start Mapping'}
                </button>
            </form>
        </div>
    );
};

export default StartupScreen;