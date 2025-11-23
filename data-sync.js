// data-sync.js - Синхронизация данных между страницами
(function() {
    'use strict';
    
    const DATA_KEY = 'petochania_sync_data';
    
    // Функция для получения данных
    function getData() {
        try {
            // Пробуем получить из sessionStorage (кросс-доменный доступ)
            const sessionData = sessionStorage.getItem('petochania_data');
            if (sessionData) {
                return JSON.parse(sessionData);
            }
            
            // Пробуем получить из localStorage
            const localData = localStorage.getItem(DATA_KEY);
            if (localData) {
                return JSON.parse(localData);
            }
            
            return null;
        } catch (error) {
            console.error('Ошибка получения данных:', error);
            return null;
        }
    }
    
    // Функция для сохранения данных
    function saveData(data) {
        try {
            // Сохраняем в sessionStorage для кросс-доменного доступа
            sessionStorage.setItem('petochania_data', JSON.stringify(data));
            
            // Сохраняем в localStorage как резерв
            localStorage.setItem(DATA_KEY, JSON.stringify(data));
            
            return true;
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            return false;
        }
    }
    
    // Функция для получения данных конкретной породы
    function getBreedData(breedId) {
        const allData = getData();
        if (allData && allData.breedPages) {
            return allData.breedPages[breedId];
        }
        return null;
    }
    
    // Функция для получения видео
    function getVideos() {
        const allData = getData();
        return allData?.videos || [];
    }
    
    // Экспортируем функции в глобальную область видимости
    window.PetochaniaData = {
        getData,
        saveData,
        getBreedData,
        getVideos
    };
    
    console.log('Petochania Data Sync loaded');
})();
