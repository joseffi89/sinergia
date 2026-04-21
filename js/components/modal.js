window.Modal = {
    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.title = document.getElementById('modal-title');
        this.body = document.getElementById('modal-body');
        this.footer = document.getElementById('modal-footer');
        
        document.getElementById('btn-close-modal').addEventListener('click', () => this.close());
    },

    show(title, bodyHtml, footerHtml) {
        if (!this.overlay) this.init();
        
        this.title.textContent = title;
        this.body.innerHTML = bodyHtml;
        this.footer.innerHTML = footerHtml;
        
        this.overlay.classList.add('active');
    },

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
    }
};
