// frontend/src/components/Login/LoginScreen.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LoginScreen.css';

const LoginScreen = ({ onLogin, error, isLoading }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { t } = useTranslation();

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleSubmit}>
                <h1>{t('login.title')}</h1>
                <p>{t('login.subtitle')}</p>
                <div className="login-control-group">
                    <label htmlFor="username">{t('login.username')}</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        required
                    />
                </div>
                <div className="login-control-group">
                    <label htmlFor="password">{t('login.password')}</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </div>
                {error && <p className="login-error-message">{error}</p>}
                <button type="submit" className="login-button" disabled={isLoading}>
                    {isLoading ? t('app.loading') : t('login.button')}
                </button>
            </form>
        </div>
    );
};

export default LoginScreen;