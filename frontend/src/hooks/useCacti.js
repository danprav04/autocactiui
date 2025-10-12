// frontend/src/hooks/useCacti.js
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';

export const useCacti = (setError, token) => {
  const [cactiGroups, setCactiGroups] = useState([]);
  const [selectedCactiGroupId, setSelectedCactiGroupId] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    // Only fetch data if the user is authenticated (token exists)
    if (!token) return;

    const fetchCactiGroups = async () => {
      try {
        const response = await api.getCactiGroups();
        const groups = response.data.data;
        if (response.data.status === 'success' && groups.length > 0) {
          setCactiGroups(groups);
          setSelectedCactiGroupId(groups[0].id);
        }
      } catch (err) {
        setError(t('app.errorCacti'));
        console.error(err);
      }
    };
    fetchCactiGroups();
  }, [t, setError, token]);

  return { cactiGroups, selectedCactiGroupId, setSelectedCactiGroupId };
};