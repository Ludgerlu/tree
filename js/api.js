const API = {
    async call(action, body = {}) {
        try {
            const formData = new FormData();
            formData.append('action', action);
            if (Object.keys(body).length > 0) {
                formData.append('data', JSON.stringify(body));
            }
            
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Erreur réseau');
            const data = await response.json();
            
            if (!data.ok) {
                throw new Error(data.error || 'Erreur serveur');
            }
            return data;
        } catch (err) {
            UI.showToast(err.message, true);
            throw err;
        }
    },

    async upload(formData) {
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Erreur réseau lors de l\'upload');
            const data = await response.json();
            if (!data.ok) throw new Error(data.error || 'Erreur upload');
            return data;
        } catch (err) {
            UI.showToast(err.message, true);
            throw err;
        }
    },

    async load() {
        const data = await this.call('load');
        State.members = data.members || [];
        State.settings = data.settings || {};
        State.auth = data.auth || { authenticated: false };
        // data.family_photos ignored for now in focus mode, can be added later
        
        UI.updateAuthDisplay();
        UI.updateSettingsDisplay();
        
        // Start rendering the tree
        Tree.init();
    },

    async login() {
        const user = document.getElementById('auth-user').value;
        const pass = document.getElementById('auth-pass').value;
        
        try {
            const data = await this.call('login', { username: user, password: pass });
            State.auth = { authenticated: true, user: data.user };
            UI.closeSheet('sheet-auth');
            UI.showToast('Connecté avec succès');
            UI.updateAuthDisplay();
            document.getElementById('form-auth').reset();
            document.getElementById('auth-error').style.display = 'none';
        } catch (err) {
            document.getElementById('auth-error').textContent = err.message;
            document.getElementById('auth-error').style.display = 'block';
        }
    },

    async logout() {
        await this.call('logout');
        State.auth = { authenticated: false };
        UI.updateAuthDisplay();
        UI.showToast('Déconnecté');
    },

    async saveSettings() {
        const treeName = document.getElementById('s-treename').value;
        const newSettings = { treeName, theme: 'forest', orientation: 'top' }; // theme/orient simplified for now
        
        await this.call('save_settings', newSettings);
        State.settings = newSettings;
        UI.updateSettingsDisplay();
        UI.closeSheet('sheet-settings');
        UI.showToast('Paramètres enregistrés');
    },

    exportJSON() {
        const dataStr = JSON.stringify({ members: State.members, settings: State.settings }, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'arbre_genealogique.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    },

    async importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.members) throw new Error("Format JSON invalide");
                await this.call('import', json);
                UI.showToast('Importation réussie');
                UI.closeSheet('sheet-settings');
                this.load();
            } catch (err) {
                UI.showToast(err.message, true);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // reset
    },

    async clearAll() {
        if (confirm("Voulez-vous vraiment effacer tout l'arbre ? Cette action est irréversible.")) {
            await this.call('clear_all');
            UI.showToast('Arbre effacé');
            this.load();
            UI.closeSheet('sheet-settings');
        }
    }
};
