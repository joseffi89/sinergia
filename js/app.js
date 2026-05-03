document.addEventListener('DOMContentLoaded', () => {
    // Inicializar App
    App.init();
});

const App = {
    currentView: 'turnos',

    async init() {
        // Esperar a que Grist esté genuinamente listo
        await GristData.init();

        // Precargar TODAS las tablas en paralelo antes de mostrar nada
        await GristData.prefetchAll();

        this.setupNavigation();
        this.setupActions();

        document.getElementById('user-role').textContent = 'Admin';

        // Recién ahora cargar la vista inicial — los datos ya están en caché
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
                        // Ordenar planes alfabéticamente
                        const planesSorted = planes.id.map((pid, i) => ({
                            id: pid,
                            nombre: planes.nombre_plan[i]
                        })).sort((a, b) => a.nombre.localeCompare(b.nombre));

                        planesSorted.forEach(p => {
                            options += `<option value="${p.id}">${p.nombre}</option>`;
                        });
                    }
                } catch(e) {}

                const hoy = new Date().toISOString().split('T')[0];

                const formHtml = `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Apellido *</label>
                            <input type="text" id="al-apellido" class="form-control" placeholder="Pérez">
                        </div>
                        <div class="form-group">
                            <label>Nombre *</label>
                            <input type="text" id="al-nombre" class="form-control" placeholder="Juan">
                        </div>
                        <div class="form-group" style="flex: 0 0 120px;">
                            <label>DNI</label>
                            <input type="text" id="al-dni" class="form-control" placeholder="123...">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Teléfono</label>
                            <input type="text" id="al-telefono" class="form-control" placeholder="11 1234 5678">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="al-email" class="form-control" placeholder="juan@ejemplo.com">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Fecha de Ingreso</label>
                            <input type="date" id="al-fecha-ingreso" class="form-control" value="${hoy}">
                        </div>
                        <div class="form-group">
                            <label>Plan *</label>
                            <select id="al-plan" class="form-control">${options}</select>
                        </div>
                    </div>
                `;
                const footerHtml = `
                    <button class="btn btn-secondary" id="btn-cancelar">Cancelar</button>
                    <button class="btn btn-primary" id="btn-guardar-al">Guardar</button>
                `;
                window.Modal.show('Nuevo Alumno', formHtml, footerHtml);

                document.getElementById('btn-cancelar').addEventListener('click', () => window.Modal.close());
                document.getElementById('btn-guardar-al').addEventListener('click', async () => {
                    const nombre = document.getElementById('al-nombre').value.trim();
                    const apellido = document.getElementById('al-apellido').value.trim();
                    const planId = document.getElementById('al-plan').value;

                    if (!nombre || !apellido || !planId) {
                        alert('Nombre, Apellido y Plan son campos obligatorios.');
                        return;
                    }

                    const data = {
                        nombre: nombre,
                        apellido: apellido,
                        dni: document.getElementById('al-dni').value,
                        email: document.getElementById('al-email').value,
                        telefono: document.getElementById('al-telefono').value,
                        fecha_ingreso: document.getElementById('al-fecha-ingreso').value, // Formato YYYY-MM-DD compatible con Date
                        plan_id: parseInt(planId) || null,
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
                if(window.ViewTurnos) window.ViewTurnos.openNewHorarioModal();
            });
        }

        // Setup Modal "Nuevo Plan"
        const btnNuevoPlan = document.getElementById('btn-nuevo-plan');
        if (btnNuevoPlan) {
            btnNuevoPlan.addEventListener('click', () => {
                if(window.ViewPlanes) window.ViewPlanes.openNewModal();
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

    loadView(viewName, isAuthBypass = false) {
        const sensitiveViews = ['pagos', 'gastos'];
        
        // Si es una vista sensible y no venimos de una validación exitosa, pedir clave
        if (sensitiveViews.includes(viewName) && !isAuthBypass) {
            this.showAuthModal(viewName);
            return;
        }

        // Ocultar todas las vistas
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // Mostrar vista objetivo
        const targetEl = document.getElementById(`view-${viewName}`);
        if (targetEl) targetEl.classList.add('active');
        
        this.currentView = viewName;

        // Actualizar estado activo en la navegación (por si se llama desde código)
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            if (btn.dataset.view === viewName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Render data logic
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
    },

    showAuthModal(targetView) {
        const title = '<i class="ph ph-lock-key"></i> Acceso Restringido';
        const bodyHtml = `
            <div style="text-align:center; padding: 10px 0;">
                <p style="margin-bottom: 20px; font-size: 14px; color: var(--text-muted);">Esta vista contiene información financiera sensible. Ingrese la contraseña de administrador para continuar.</p>
                <div class="form-group">
                    <input type="password" id="admin-password" class="form-control" placeholder="••••••••" style="text-align:center; font-size: 24px; letter-spacing: 8px; background: rgba(0,0,0,0.3);">
                </div>
                <p id="auth-error" style="color: var(--danger); font-size: 13px; margin-top: 15px; display: none; font-weight: 500;">
                    <i class="ph ph-warning-circle"></i> Contraseña incorrecta. Intente de nuevo.
                </p>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-secondary" id="btn-auth-cancel">Cancelar</button>
            <button class="btn btn-primary" id="btn-auth-confirm" style="padding: 10px 30px;">Ingresar</button>
        `;

        window.Modal.show(title, bodyHtml, footerHtml);

        const input = document.getElementById('admin-password');
        setTimeout(() => input.focus(), 100); // Pequeño delay para asegurar que el DOM está listo

        const validate = () => {
            if (input.value === 'giasiner2026') {
                window.Modal.close();
                this.loadView(targetView, true);
            } else {
                const errorEl = document.getElementById('auth-error');
                errorEl.style.display = 'block';
                input.value = '';
                input.focus();
                // Efecto de vibración opcional si hubiera CSS, pero por ahora solo el mensaje
            }
        };

        document.getElementById('btn-auth-confirm').addEventListener('click', validate);
        document.getElementById('btn-auth-cancel').addEventListener('click', () => {
            window.Modal.close();
            // No hacemos nada, el usuario se queda en la vista donde estaba
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validate();
        });
    }
};
