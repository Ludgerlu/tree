const UI = {
    currentSheet: null,
    currentDetailId: null,

    // ===== TOAST =====
    showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.style.backgroundColor = isError ? 'var(--danger)' : 'var(--text-primary)';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    // ===== BOTTOM SHEETS =====
    openSheet(sheetId) {
        if (this.currentSheet) this.closeSheet(this.currentSheet);
        const overlay = document.getElementById(sheetId);
        if (overlay) {
            overlay.classList.add('active');
            this.currentSheet = sheetId;
        }
    },
    
    closeSheet(sheetId) {
        const overlay = document.getElementById(sheetId);
        if (overlay) {
            overlay.classList.remove('active');
            if (this.currentSheet === sheetId) this.currentSheet = null;
        }
    },

    openAuth() { this.openSheet('sheet-auth'); },
    openSettings() { 
        document.getElementById('s-treename').value = State.settings.treeName || 'Ma Famille';
        this.openSheet('sheet-settings'); 
    },
    openSearch() {
        // Simple prompt for now, could be a proper select2/search modal later
        const name = prompt("Entrez le prénom ou nom à rechercher :");
        if (!name) return;
        const term = name.toLowerCase();
        const found = State.members.find(m => 
            m.firstname.toLowerCase().includes(term) || 
            m.lastname.toLowerCase().includes(term)
        );
        if (found) {
            Tree.setCenter(found.id);
        } else {
            this.showToast("Membre introuvable", true);
        }
    },

    // ===== HEADER DISPLAY =====
    updateAuthDisplay() {
        const statusEl = document.getElementById('user-status-display');
        const btnLogin = document.getElementById('btn-login');
        const btnLogout = document.getElementById('btn-logout');
        const btnAdd = document.getElementById('btn-add-member');
        
        if (State.auth.authenticated) {
            statusEl.innerHTML = `<i class="fa-solid fa-circle text-success" style="font-size:8px;"></i> ${State.auth.user.username}`;
            btnLogin.style.display = 'none';
            btnLogout.style.display = 'inline-flex';
            btnAdd.style.display = 'inline-flex';
        } else {
            statusEl.innerHTML = `<i class="fa-solid fa-circle text-secondary" style="font-size:8px;"></i> Non connecté`;
            btnLogin.style.display = 'inline-flex';
            btnLogout.style.display = 'none';
            btnAdd.style.display = 'none';
        }
    },
    
    updateSettingsDisplay() {
        const titleEl = document.getElementById('tree-name-display');
        titleEl.textContent = State.settings.treeName || 'Arbre Généalogique';
    },

    // ===== MEMBER MODAL (DETAIL & FORM) =====
    openMemberDetail(memberId) {
        this.currentDetailId = memberId;
        const member = State.getMember(memberId);
        if (!member) return;

        // Populate detail view
        const avatarEl = document.getElementById('detail-avatar');
        if (member.photo_file) {
            avatarEl.innerHTML = `<img src="uploads/${member.photo_file}" alt="photo">`;
            avatarEl.style.border = 'none';
        } else {
            const initial = member.firstname ? member.firstname.charAt(0).toUpperCase() : '?';
            avatarEl.innerHTML = initial;
            // Generate a color based on ID roughly for visual variety
            const genLevel = Tree.getGen(member.id) % 5;
            avatarEl.style.borderColor = `var(--gen${genLevel})`;
        }
        
        document.getElementById('detail-name').textContent = `${member.firstname} ${member.lastname}`;
        
        // Dates & Places
        let datesText = '';
        if (member.birth) datesText += `° ${this.formatDate(member.birth)} ${member.birthplace ? '('+member.birthplace+')' : ''}`;
        if (member.death) datesText += ` - † ${this.formatDate(member.death)} ${member.deathplace ? '('+member.deathplace+')' : ''}`;
        document.getElementById('detail-dates').textContent = datesText;
        
        document.getElementById('detail-notes').textContent = member.notes || 'Aucune note.';
        
        // Show/hide actions based on auth
        document.getElementById('detail-actions').style.display = State.auth.authenticated ? 'flex' : 'none';
        
        this.switchToDetailMode();
        this.openSheet('sheet-member');
    },

    switchToDetailMode() {
        document.getElementById('sheet-member-title').textContent = "Détails";
        document.getElementById('view-member-detail').style.display = 'block';
        document.getElementById('view-member-form').style.display = 'none';
        document.getElementById('form-member-footer').style.display = 'none';
    },

    switchToEditMode() {
        const member = State.getMember(this.currentDetailId);
        if (!member) return;
        
        document.getElementById('sheet-member-title').textContent = "Modifier le membre";
        document.getElementById('view-member-detail').style.display = 'none';
        document.getElementById('view-member-form').style.display = 'block';
        document.getElementById('form-member-footer').style.display = 'flex';
        
        this.populateForm(member);
    },

    openMemberModal() { // For adding new
        document.getElementById('sheet-member-title').textContent = "Nouveau membre";
        document.getElementById('view-member-detail').style.display = 'none';
        document.getElementById('view-member-form').style.display = 'block';
        document.getElementById('form-member-footer').style.display = 'flex';
        
        this.populateForm(null);
        this.openSheet('sheet-member');
    },

    populateForm(member) {
        const form = document.getElementById('form-member');
        form.reset();
        
        // Populate parent/spouse selects
        const parentSel = document.getElementById('f-parent');
        const spouseSel = document.getElementById('f-spouse');
        parentSel.innerHTML = '<option value="">-- Aucun --</option>';
        spouseSel.innerHTML = '<option value="">-- Aucun --</option>';
        
        State.members.forEach(m => {
            if (member && m.id === member.id) return; // Can't be own parent/spouse
            const opt1 = new Option(`${m.firstname} ${m.lastname}`, m.id);
            const opt2 = new Option(`${m.firstname} ${m.lastname}`, m.id);
            parentSel.add(opt1);
            spouseSel.add(opt2);
        });

        // Reset photo preview
        document.getElementById('form-avatar-preview').innerHTML = '';
        document.getElementById('f-photo-file').value = '';
        document.getElementById('upload-progress').textContent = '';

        if (member) {
            document.getElementById('f-id').value = member.id;
            document.getElementById('f-firstname').value = member.firstname || '';
            document.getElementById('f-lastname').value = member.lastname || '';
            document.getElementById('f-gender').value = member.gender || 'M';
            document.getElementById('f-birth').value = member.birth || '';
            document.getElementById('f-birthplace').value = member.birthplace || '';
            document.getElementById('f-death').value = member.death || '';
            document.getElementById('f-deathplace').value = member.deathplace || '';
            document.getElementById('f-notes').value = member.notes || '';
            parentSel.value = member.parentId || '';
            spouseSel.value = member.spouseId || '';
            
            if (member.photo_file) {
                document.getElementById('f-photo-file').value = member.photo_file;
                document.getElementById('form-avatar-preview').innerHTML = `<img src="uploads/${member.photo_file}" alt="photo">`;
            }
        } else {
            document.getElementById('f-id').value = '';
            // If we are centered on someone, maybe auto-fill them as parent? 
            if (Tree.centerId) {
                parentSel.value = Tree.centerId;
            }
        }
    },

    async saveMember() {
        const form = document.getElementById('form-member');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const id = document.getElementById('f-id').value;
        const memberData = {
            firstname: document.getElementById('f-firstname').value,
            lastname: document.getElementById('f-lastname').value,
            gender: document.getElementById('f-gender').value,
            birth: document.getElementById('f-birth').value,
            birthplace: document.getElementById('f-birthplace').value,
            death: document.getElementById('f-death').value,
            deathplace: document.getElementById('f-deathplace').value,
            parentId: document.getElementById('f-parent').value || null,
            spouseId: document.getElementById('f-spouse').value || null,
            notes: document.getElementById('f-notes').value,
            photo_file: document.getElementById('f-photo-file').value || null
        };

        if (!id) memberData.id = State.generateId();
        else memberData.id = id;

        const action = id ? 'update' : 'add';
        
        try {
            await API.call(action, { member: memberData });
            this.showToast(id ? 'Membre mis à jour' : 'Membre ajouté');
            this.closeSheet('sheet-member');
            
            // Reload data and redraw
            await API.load();
            
            // If new, center on it. If edit, re-render around current center
            if (!id) Tree.setCenter(memberData.id);
            else Tree.render();
            
        } catch (err) {
            this.showToast(err.message, true);
        }
    },
    
    async deleteCurrentMember() {
        if (!this.currentDetailId) return;
        if (!confirm("Voulez-vous vraiment supprimer ce membre ? Cela supprimera aussi ses connexions.")) return;
        
        try {
            await API.call('delete', { id: this.currentDetailId });
            this.showToast("Membre supprimé");
            this.closeSheet('sheet-member');
            this.currentDetailId = null;
            await API.load();
            
            // If we deleted the center node, center on root (or first available)
            if (Tree.centerId === this.currentDetailId) {
                const root = State.members.length > 0 ? State.members[0] : null;
                if (root) Tree.setCenter(root.id);
                else Tree.render();
            } else {
                Tree.render();
            }
            
        } catch(err) {
            this.showToast(err.message, true);
        }
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
    }
};

// Close sheets when clicking on overlay background
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('overlay')) {
        UI.closeSheet(e.target.id);
    }
});
