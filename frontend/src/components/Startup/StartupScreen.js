// frontend/src/components/Startup/StartupScreen.js
import React, { useRef } from 'react';

const StartupScreen = ({ onStart, isLoading }) => {
    const initialIpRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (initialIpRef.current) {
            onStart(initialIpRef.current.value);
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
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Start Mapping'}
                </button>
            </form>
        </div>
    );
};

export default StartupScreen;