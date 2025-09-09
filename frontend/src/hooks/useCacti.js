// frontend/src/hooks/useCacti.js
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';

export const useCacti = (setError, token) => {
  const [cactiInstallations, setCactiInstallations] = useState([]);
  const [selectedCactiId, setSelectedCactiId] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    // Only fetch data if the user is authenticated (token exists)
    if (!token) return;

    const fetchCactiInstallations = async () => {
      try {
        const response = await api.getAllCactiInstallations();
        const installations = response.data.data;
        if (response.data.status === 'success' && installations.length > 0) {
          setCactiInstallations(installations);
          setSelectedCactiId(installations[0].id);
        }
      } catch (err) {
        setError(t('app.errorCacti'));
        console.error(err);
      }
    };
    fetchCactiInstallations();
  }, [t, setError, token]);

  return { cactiInstallations, selectedCactiId, setSelectedCactiId };
};