// frontend/src/components/ContextMenu/ContextMenu.js
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const ContextMenu = ({ node, top, left, onClose, onDeleteElements, bringToFront, sendToBack, bringForward, sendBackward }) => {
    const menuRef = useRef(null);
    const { t } = useTranslation();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const createAction = (label, action, className = '') => (
        <button className={`context-menu-item ${className}`} onClick={() => { action(); onClose(); }}>
            {label}
        </button>
    );

    return (
        <div ref={menuRef} className="context-menu" style={{ top, left }}>
            {createAction(t('sidebar.bringForward'), bringForward)}
            {createAction(t('sidebar.sendBackward'), sendBackward)}
            {createAction(t('sidebar.bringToFront'), bringToFront)}
            {createAction(t('sidebar.sendToBack'), sendToBack)}
            <div className="context-menu-separator" />
            {createAction(t('sidebar.deleteSelected'), onDeleteElements, 'danger')}
        </div>
    );
};

export default ContextMenu;