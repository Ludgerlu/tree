const Tree = {
    centerId: null,
    renderedNodes: new Map(), // DOM elements by ID
    
    // Config
    gapY: 200,
    gapX: 250,
    
    init() {
        // Find a starting center. Usually the root (no parent) or first member
        if (State.members.length === 0) return;
        
        let root = State.members.find(m => !m.parentId);
        if (!root) root = State.members[0];
        
        this.centerId = root.id;
        this.render(false); // Initial render without animation
    },

    setCenter(id) {
        if (this.centerId === id) return;
        
        const oldId = this.centerId;
        this.centerId = id;
        
        // Find if the new center is currently on screen
        const targetNodeEl = this.renderedNodes.get(id);
        
        if (targetNodeEl) {
            // Animate transition
            const rect = targetNodeEl.getBoundingClientRect();
            const containerRect = document.getElementById('tree-canvas').getBoundingClientRect();
            
            // Calculate how much we need to move the whole layer to put target at center
            const targetX = rect.left + rect.width / 2 - containerRect.left;
            const targetY = rect.top + rect.height / 2 - containerRect.top;
            
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            
            const dx = centerX - targetX;
            const dy = centerY - targetY;
            
            const layer = document.getElementById('nodes-layer');
            const svgLayer = document.getElementById('lines-layer');
            
            // Move layer
            layer.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
            svgLayer.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
            layer.style.transform = `translate(${dx}px, ${dy}px)`;
            svgLayer.style.transform = `translate(${dx}px, ${dy}px)`;
            
            // Wait for movement, then re-render and snap back
            setTimeout(() => {
                layer.style.transition = 'none';
                svgLayer.style.transition = 'none';
                layer.style.transform = 'translate(0, 0)';
                svgLayer.style.transform = 'translate(0, 0)';
                this.render(true);
                
                // Update breadcrumb
                this.updateBreadcrumb();
            }, 500);
            
        } else {
            // Target not on screen, just re-render directly
            this.render(true);
            this.updateBreadcrumb();
        }
    },

    render(animateIn = true) {
        if (!this.centerId) return;
        const centerMember = State.getMember(this.centerId);
        if (!centerMember) return;

        const layer = document.getElementById('nodes-layer');
        // Keep track of what we want to keep
        const newNodes = new Map();
        
        // 1. Calculate Layout (Logical Coordinates relative to center 0,0)
        const layout = this.calculateLayout(centerMember);
        
        // 2. Create/Update DOM nodes
        layout.forEach(pos => {
            let el = this.renderedNodes.get(pos.id);
            if (!el) {
                el = this.createNodeElement(pos.member);
                layer.appendChild(el);
            }
            
            // Update positioning
            el.style.left = `calc(50% + ${pos.x}px)`;
            el.style.top = `calc(50% + ${pos.y}px)`;
            
            // Update classes
            el.className = 'member-card'; // Reset
            if (pos.id === this.centerId) el.classList.add('is-center');
            if (pos.member.death) el.classList.add('is-deceased');
            
            // Trigger animation frame for CSS transition
            requestAnimationFrame(() => {
                el.classList.add('visible');
            });
            
            newNodes.set(pos.id, el);
        });
        
        // 3. Remove old nodes that are not in the new layout
        this.renderedNodes.forEach((el, id) => {
            if (!newNodes.has(id)) {
                el.classList.remove('visible');
                setTimeout(() => {
                    if (el.parentNode === layer) layer.removeChild(el);
                }, 600); // Wait for CSS transition
            }
        });
        
        this.renderedNodes = newNodes;
        
        // 4. Draw Lines
        this.drawLines(layout, centerMember);
    },

    calculateLayout(centerMember) {
        const layout = [];
        
        // Center
        layout.push({ id: centerMember.id, member: centerMember, x: 0, y: 0, type: 'center' });
        
        // Parent (only 1 parent supported in current DB schema)
        if (centerMember.parentId) {
            const parent = State.getMember(centerMember.parentId);
            if (parent) {
                layout.push({ id: parent.id, member: parent, x: 0, y: -this.gapY, type: 'parent' });
            }
        }
        
        // Spouses
        const spouses = State.members.filter(m => m.spouseId === centerMember.id || centerMember.spouseId === m.id);
        spouses.forEach((spouse, index) => {
            layout.push({ 
                id: spouse.id, 
                member: spouse, 
                x: this.gapX * (index + 1), // To the right
                y: 0, 
                type: 'spouse' 
            });
        });
        
        // Children (From center AND from spouses if they have this center as spouse)
        // Wait, current schema: child has parentId.
        const children = State.getChildren(centerMember.id);
        
        // Also get children of the spouses where the spouse is the parentId
        spouses.forEach(spouse => {
            const spouseChildren = State.getChildren(spouse.id);
            spouseChildren.forEach(sc => {
                if (!children.find(c => c.id === sc.id)) {
                    children.push(sc);
                }
            });
        });

        // Spread children along X axis
        const totalChildren = children.length;
        const startX = -((totalChildren - 1) * this.gapX) / 2;
        
        children.forEach((child, index) => {
            layout.push({
                id: child.id,
                member: child,
                x: startX + (index * this.gapX),
                y: this.gapY,
                type: 'child'
            });
        });
        
        return layout;
    },

    createNodeElement(member) {
        const el = document.createElement('div');
        
        // Avatar
        let avatarHtml = '';
        if (member.photo_file) {
            avatarHtml = `<img src="uploads/${member.photo_file}" alt="photo">`;
        } else {
            avatarHtml = member.firstname ? member.firstname.charAt(0).toUpperCase() : '?';
        }
        
        // Badges
        let badgeHtml = '';
        if (member.death) {
            badgeHtml = `<div class="badge" title="Décédé" style="color:var(--text-tertiary)"><i class="fa-solid fa-cross"></i></div>`;
        }
        
        // Dates
        let datesText = '';
        const yb = member.birth ? new Date(member.birth).getFullYear() : '?';
        const yd = member.death ? new Date(member.death).getFullYear() : '';
        if (yb !== '?' || yd !== '') {
            datesText = `${yb} ${yd ? '- ' + yd : ''}`;
        }
        
        el.innerHTML = `
            <div class="card-avatar">${avatarHtml}</div>
            <div class="card-info">
                <div class="card-name">${member.firstname} ${member.lastname}</div>
                <div class="card-dates">${datesText}</div>
            </div>
            <div class="card-badges">${badgeHtml}</div>
        `;
        
        // Interactions
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setCenter(member.id);
        });
        
        // Double click or right click for details/edit? Let's use a "Detail" button inside, 
        // or just double click
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            UI.openMemberDetail(member.id);
        });

        // Add a small detail button if on mobile (no double click)
        const btn = document.createElement('div');
        btn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        btn.style.cssText = 'position:absolute; right:8px; top:50%; transform:translateY(-50%); padding:8px; color:var(--text-tertiary); cursor:pointer;';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.openMemberDetail(member.id);
        });
        el.appendChild(btn);
        
        return el;
    },

    drawLines(layout, centerMember) {
        const svg = document.getElementById('lines-layer');
        // We need the actual dimensions to draw lines from centers
        // Since positions are calc(50% + Xpx), we can just use the X,Y values 
        // if we set the SVG viewBox to match the container with 0,0 at center.
        
        const container = document.getElementById('tree-canvas');
        const w = container.clientWidth;
        const h = container.clientHeight;
        
        // Set viewBox so 0,0 is exactly the center
        svg.setAttribute('viewBox', `${-w/2} ${-h/2} ${w} ${h}`);
        svg.innerHTML = ''; // Clear old lines
        
        const centerPos = layout.find(p => p.id === centerMember.id);
        
        layout.forEach(pos => {
            if (pos.id === centerMember.id) return;
            
            if (pos.type === 'parent') {
                this.drawCurvedLine(svg, 0, 0, 0, pos.y);
            }
            if (pos.type === 'spouse') {
                // Link spouse to center with a heart or straight line
                this.drawCurvedLine(svg, 0, 0, pos.x, pos.y, 'var(--gen2)', true);
            }
            if (pos.type === 'child') {
                // Link child to center
                // If there's a spouse, ideally the line comes from BETWEEN center and spouse
                // For simplicity, draw from center to child
                this.drawCurvedLine(svg, 0, 0, pos.x, pos.y);
            }
        });
    },

    drawCurvedLine(svg, x1, y1, x2, y2, color = 'var(--border-strong)', dashed = false) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Cubic bezier: start at x1,y1, go down/up, then curve to x2,y2
        // Control points are halfway vertically
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
        
        if (y1 === y2) { // Horizontal line (spouse)
            path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
        } else {
            path.setAttribute('d', d);
        }
        
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        if (dashed) {
            path.setAttribute('stroke-dasharray', '5,5');
        }
        
        svg.appendChild(path);
    },

    updateBreadcrumb() {
        if (!this.centerId) return;
        
        // Build lineage up to 3 levels
        const lineage = [];
        let curr = State.getMember(this.centerId);
        
        while (curr && lineage.length < 4) {
            lineage.unshift(curr);
            if (curr.parentId) {
                curr = State.getMember(curr.parentId);
            } else {
                curr = null;
            }
        }
        
        const bc = document.getElementById('breadcrumb');
        bc.innerHTML = '';
        
        lineage.forEach((m, i) => {
            const el = document.createElement('div');
            el.className = 'breadcrumb-item';
            el.textContent = m.firstname || m.lastname;
            el.onclick = () => this.setCenter(m.id);
            
            bc.appendChild(el);
            
            if (i < lineage.length - 1) {
                const sep = document.createElement('span');
                sep.className = 'breadcrumb-sep';
                sep.innerHTML = '<i class="fa-solid fa-chevron-right" style="font-size:0.7rem;"></i>';
                bc.appendChild(sep);
            }
        });
    },
    
    // Quick helper for getting generation level (if needed for colors later)
    getGen(id, currentGen = 0, visited = new Set()) {
        if (!id || visited.has(id)) return currentGen;
        visited.add(id);
        const m = State.getMember(id);
        if (!m || !m.parentId) return currentGen;
        return this.getGen(m.parentId, currentGen + 1, visited);
    }
};

// Handle window resize for SVG viewBox
window.addEventListener('resize', () => {
    if (Tree.centerId) {
        // Just redraw lines to fix viewBox
        const centerMember = State.getMember(Tree.centerId);
        if (centerMember) {
            const layout = Tree.calculateLayout(centerMember);
            Tree.drawLines(layout, centerMember);
        }
    }
});
