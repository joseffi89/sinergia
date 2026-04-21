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
        this.setupActions();
        
        // Mock User Role
        document.getElementById('user-role').textContent = 'Admin';
        
        // Cargar vista inicial (Loader mientras se espera Grist)
        this.loadView(this.currentView);
    },

    setupActions() {
        // Setup Modal "Nuevo Alumno"
        const btnNuevoAlumno = document.getElementById('btn-nuevo-alumno');
        if (btnNuevoAlumno) {
            btnNuevoAlumno.addEventListener('click', async () => {
                // Fetch planes for the dropdown
                let options = '<option value="">Seleccionar...</option>';
                try {
                    const planes = await GristData.getTable('Planes');
                    if(planes && planes.id) {
                        planes.id.forEach((pid, i) => {
                            options += `<option value="${pid}">${planes.nombre_plan[i]}</option>`;
                        });
                    }
                } catch(e) {}

                const hoy = new Date().toISOString().split('T')[0];

                const formHtml = `
                    <div class="form-group">
                        <label>Nombre</label>
                        <input type="text" id="al-nombre" class="form-control" placeholder="Ej. Juan">
                    </div>
                    <div class="form-group">
                        <label>Apellido</label>
                        <input type="text" id="al-apellido" class="form-control" placeholder="Ej. Pérez">
                    </div>
                    <div class="form-group">
                        <label>DNI</label>
                        <input type="text" id="al-dni" class="form-control" placeholder="Ej. 12345678">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="al-email" class="form-control" placeholder="Ej. juan@ejemplo.com">
                    </div>
                    <div class="form-group">
                        <label>Fecha de Ingreso</label>
                        <input type="date" id="al-fecha-ingreso" class="form-control" value="${hoy}">
                    </div>
                    <div class="form-group">
                        <label>Plan</label>
                        <select id="al-plan" class="form-control">${options}</select>
                    </div>
                `;
                const footerHtml = `
                    <button class="btn btn-secondary" id="btn-cancelar">Cancelar</button>
                    <button class="btn btn-primary" id="btn-guardar-al">Guardar</button>
                `;
                window.Modal.show('Nuevo Alumno', formHtml, footerHtml);

                document.getElementById('btn-cancelar').addEventListener('click', () => window.Modal.close());
                document.getElementById('btn-guardar-al').addEventListener('click', async () => {
                    const data = {
                        nombre: document.getElementById('al-nombre').value,
                        apellido: document.getElementById('al-apellido').value,
                        dni: document.getElementById('al-dni').value,
                        email: document.getElementById('al-email').value,
                        fecha_ingreso: document.getElementById('al-fecha-ingreso').value, // Formato YYYY-MM-DD compatible con Date
                        plan_id: parseInt(document.getElementById('al-plan').value) || null,
                        estado: 'Activo'
                    };
                    try {
                        const btn = document.getElementById('btn-guardar-al');
                        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
                        btn.disabled = true;
                        await GristData.addRecord('Alumnos', data);
                        window.Modal.close();
                        this.loadView('alumnos'); // Refresh
                    } catch (e) {
                        alert('Error al guardar el alumno');
                    }
                });
            });
        }

        // Setup Modal "Nueva Clase" (Demo)
        const btnNuevaClase = document.getElementById('btn-nueva-clase');
        if (btnNuevaClase) {
            btnNuevaClase.addEventListener('click', () => {
                window.Modal.show('Nueva Clase', '<p>Funcionalidad en desarrollo...</p>', '<button class="btn btn-primary" onclick="window.Modal.close()">Cerrar</button>');
            });
        }
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
