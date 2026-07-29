const State = {
    members: [],
    settings: {},
    auth: { authenticated: false },
    
    getMember(id) {
        return this.members.find(m => m.id === id);
    },
    
    getChildren(parentId) {
        return this.members.filter(m => m.parentId === parentId);
    },
    
    getSpouse(spouseId) {
        if (!spouseId) return null;
        return this.members.find(m => m.id === spouseId);
    },
    
    generateId() {
        return 'm' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
};
