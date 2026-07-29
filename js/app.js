// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Check initial auth and load data
    API.load().catch(err => {
        console.error("Failed to load initial data", err);
        UI.showToast("Erreur de chargement des données", true);
    });
});
