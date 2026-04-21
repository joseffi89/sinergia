document.addEventListener('DOMContentLoaded', () => {
    // Inicializar App
    App.init();
});

const App = {
    currentView: 'turnos',

    async init() {
        // Init Grist
        await GristData.init();
        
        this.setupNavigation();
        
        // Mock User Role (Idealmente sacar de una tabla Users)
        document.getElementById('user-role').textContent = 'Admin';
        
        // Cargar vista inicial
        this.loadView(this.currentView);
    },

    setupNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.view;
                
                // Update active state
                navBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // Load View
                this.loadView(targetView);
            });
        });
    },

    loadView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // Show target view
        document.getElementById(`view-${viewName}`).classList.add('active');
        this.currentView = viewName;

        // Render data logic (delegar a cada script de vista si existe)
        switch(viewName) {
            case 'turnos':
                if (window.ViewTurnos) window.ViewTurnos.render();
                break;
            case 'alumnos':
                if (window.ViewAlumnos) window.ViewAlumnos.render();
                break;
            case 'planes':
                if (window.ViewPlanes) window.ViewPlanes.render();
                break;
            case 'pagos':
                if (window.ViewPagos) window.ViewPagos.render();
                break;
            case 'gastos':
                if (window.ViewGastos) window.ViewGastos.render();
                break;
        }
    }
};
