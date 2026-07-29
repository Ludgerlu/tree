const Upload = {
    async handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const previewEl = document.getElementById('form-avatar-preview');
        const progressEl = document.getElementById('upload-progress');
        
        // Basic validation
        if (file.size > 5 * 1024 * 1024) {
            UI.showToast("Fichier trop lourd (max 5 Mo)", true);
            return;
        }
        
        // Show preview immediately
        const objUrl = URL.createObjectURL(file);
        previewEl.innerHTML = `<img src="${objUrl}" alt="Preview">`;
        progressEl.textContent = "Compression...";
        
        try {
            // Compress
            const compressedBlob = await this.compressImage(file);
            progressEl.textContent = "Envoi...";
            
            // Upload
            const formData = new FormData();
            formData.append('action', 'upload_photo');
            formData.append('photo', compressedBlob, file.name);
            
            const data = await API.upload(formData);
            
            // Save filename to hidden input
            document.getElementById('f-photo-file').value = data.file;
            progressEl.textContent = "Image prête !";
            progressEl.style.color = "var(--accent)";
            
        } catch (err) {
            progressEl.textContent = "Erreur: " + err.message;
            progressEl.style.color = "var(--danger)";
        }
    },
    
    compressImage(file, maxWidth = 480, maxHeight = 600, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Lecture impossible'));
            reader.onload = ev => {
                const img = new Image();
                img.onerror = () => reject(new Error('Image invalide'));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    
                    const ratio = Math.min(maxWidth / w, maxHeight / h);
                    if (ratio < 1) { 
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio); 
                    }
                    
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    canvas.toBlob(blob => {
                        if(blob) resolve(blob);
                        else reject(new Error('Compression échouée'));
                    }, 'image/jpeg', quality);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
};
