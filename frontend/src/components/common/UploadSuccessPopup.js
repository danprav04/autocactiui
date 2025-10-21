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
    // Ref to track if the component is mounted.
    // This prevents state updates or new polls after the popup is closed.
    const isMountedRef = useRef(false);

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

    // This effect manages the entire polling lifecycle.
    useEffect(() => {
        isMountedRef.current = true; // Mark as mounted

        // Define a recursive async function to poll task statuses
        const checkStatus = async () => {
            // Stop polling if the component has unmounted
            if (!isMountedRef.current) return;

            let allTasksFinished = true;
            let shouldPollAgain = false; // Flag to see if recursion is needed

            // We must use a functional update to get the *latest* task state
            // and then return an array of promises for the updates.
            const updatedTasks = await new Promise((resolve) => {
                setTasks(currentTasks => {
                    // Map over tasks to create an array of API call promises
                    const promises = currentTasks.map(async (task) => {
                        // If task is already done, just return it
                        if (task.status === 'SUCCESS' || task.status === 'FAILURE') {
                            return task;
                        }
                        
                        allTasksFinished = false; // Found at least one unfinished task

                        try {
                            const response = await api.getTaskStatus(task.task_id);
                            const { status, message } = response.data;
                            
                            if (status === 'SUCCESS') {
                                return { ...task, status: 'SUCCESS', url: message };
                            }
                            if (status === 'FAILURE' || status === 'REVOKED') {
                                return { ...task, status: 'FAILURE', error: message };
                            }

                            // Task is PENDING, STARTED, RETRY, etc.
                            shouldPollAgain = true; // Mark that we need to poll again
                            return { ...task, status }; // Return updated pending status

                        } catch (err) {
                            console.error(`Failed to get status for task ${task.task_id}:`, err);
                            return { ...task, status: 'FAILURE', error: t('app.errorTaskStatus') };
                        }
                    });

                    // When all API calls are done, resolve the outer promise
                    // with the new array of task objects.
                    Promise.all(promises).then(resolve);
                    
                    // Return currentTasks *for this render cycle*.
                    // The .then(resolve) ensures `updatedTasks` gets the *new* array
                    return currentTasks;
                });
            });

            // Now that all promises are resolved and `updatedTasks` has the new array,
            // update the state *if* we are still mounted.
            if (isMountedRef.current) {
                setTasks(updatedTasks);

                // *** LONG POLLING FIX ***
                // If we're not done and at least one task was still pending,
                // call checkStatus() again immediately to start the next long poll.
                if (!allTasksFinished && shouldPollAgain) {
                    checkStatus();
                }
            }
        };

        // Start polling only if there are tasks.
        if (tasks.length > 0) {
            checkStatus();
        }

        // Cleanup function: This runs when the component unmounts
        // (popup closes) or when `tasks.length` changes (new upload).
        // This stops any in-flight polls from updating state.
        return () => {
            isMountedRef.current = false;
        };
        // This effect's dependency MUST be tasks.length.
        // When `data` changes, the first effect runs, `setTasks` runs,
        // `tasks.length` changes, which triggers this effect's cleanup
        // (stopping old polls) and then runs it again (starting new polls).
    }, [tasks.length, t]);

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
            default: // PENDING, PROCESSING, STARTED, RETRY
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