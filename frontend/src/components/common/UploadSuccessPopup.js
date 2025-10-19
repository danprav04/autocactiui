// frontend/src/components/common/UploadSuccessPopup.js
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/apiService';
import './UploadSuccessPopup.css';

// --- SVG Icons for Task Status ---

const SpinnerIcon = () => (
    <svg className="status-spinner" viewBox="0 0 50 50">
        <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
    </svg>
);

const SuccessIcon = () => (
    <svg className="status-icon" viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
);

const ErrorIcon = () => (
    <svg className="status-icon error" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
);


const UploadSuccessPopup = ({ data, onClose }) => {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState([]);
    const pollingRef = useRef(null);

    // This effect is solely responsible for initializing the component's state
    // when the `data` prop changes (i.e., when the popup is opened).
    useEffect(() => {
        if (data && data.tasks) {
            const initialTasks = data.tasks.map(task => ({
                ...task,
                status: 'PENDING',
                url: null,
                error: null,
            }));
            setTasks(initialTasks);
        } else {
            setTasks([]);
        }
    }, [data]);

    // This effect manages the polling lifecycle. It runs only when the component
    // mounts or when the number of tasks changes, but crucially, NOT when the
    // status of individual tasks is updated.
    useEffect(() => {
        const pollTasks = async () => {
            // Use the functional form of setTasks to get the most recent state
            // without needing `tasks` in the dependency array.
            setTasks(currentTasks => {
                // If there are no tasks, do nothing.
                if (currentTasks.length === 0) {
                    return currentTasks;
                }

                // Check if all tasks have reached a terminal state.
                const allTasksFinished = currentTasks.every(
                    t => t.status === 'SUCCESS' || t.status === 'FAILURE'
                );

                if (allTasksFinished) {
                    // If all tasks are done, clear the interval and return the state as-is.
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                    return currentTasks;
                }
                
                // Asynchronously update all tasks that are still pending/processing.
                Promise.all(
                    currentTasks.map(async (task) => {
                        if (task.status === 'SUCCESS' || task.status === 'FAILURE') {
                            return task; // Return completed tasks unchanged.
                        }
                        try {
                            const response = await api.getTaskStatus(task.task_id);
                            const { status, message } = response.data;
                            if (status === 'SUCCESS') {
                                return { ...task, status: 'SUCCESS', url: message };
                            }
                            if (status === 'FAILURE') {
                                return { ...task, status: 'FAILURE', error: message };
                            }
                            return { ...task, status };
                        } catch (err) {
                            console.error(`Failed to get status for task ${task.task_id}:`, err);
                            return { ...task, status: 'FAILURE', error: t('app.errorTaskStatus') };
                        }
                    })
                ).then(updatedTasks => {
                    setTasks(updatedTasks);
                });
                
                // Return the original state for this render cycle; the updated
                // state will be applied in the next render after the promises resolve.
                return currentTasks;
            });
        };

        // Start polling only if there are tasks and no interval is already running.
        if (tasks.length > 0 && !pollingRef.current) {
            pollTasks(); // Initial poll
            pollingRef.current = setInterval(pollTasks, 3000); // Subsequent polls
        }

        // Cleanup function: This is crucial. It runs when the component unmounts
        // (e.g., when the popup is closed), stopping any ongoing polling.
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [tasks.length, t]); // The effect now only depends on the *number* of tasks and the translation function.

    if (!data || !data.tasks || data.tasks.length === 0) {
        return null;
    }

    const renderTaskStatus = (task) => {
        switch (task.status) {
            case 'SUCCESS':
                return (
                    <a href={task.url} target="_blank" rel="noopener noreferrer" className="popup-button primary task-action-button">
                        <SuccessIcon /> {t('app.goToMap')}
                    </a>
                );
            case 'FAILURE':
                return (
                    <div className="task-status-indicator error" title={task.error}>
                        <ErrorIcon />
                        <span>{t('app.statusFailed')}</span>
                    </div>
                );
            default: // PENDING or PROCESSING
                return (
                    <div className="task-status-indicator pending">
                        <SpinnerIcon />
                        <span>{t('app.statusProcessing')}</span>
                    </div>
                );
        }
    };

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
                <p>{data.message}</p>
                
                <ul className="task-list-container">
                    {tasks.map(task => (
                        <li key={task.task_id} className="task-list-item">
                            <span className="task-hostname">{task.hostname}</span>
                            {renderTaskStatus(task)}
                        </li>
                    ))}
                </ul>

                <div className="popup-actions">
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