window.ViewAlumnos = {
    currentData: null,
    planesMap: {},
    async render() {
        const container = document.getElementById('alumnos-container');
        
        // Carga inmediata con caché
        if (this.currentData) {
            this.drawUI();
        } else {
            container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando alumnos...</p>';
        }

        try {
            // Actualización en segundo plano
            const alumnos = await GristData.getTable('Alumnos');
            this.currentData = alumnos;
            const planes = await GristData.getTable('Planes');

            if (!alumnos) {
                if (!this.currentData) container.innerHTML = '<p style="color: var(--danger);">Error al cargar alumnos.</p>';
                return;
            }

            // Mapeo de Planes
            this.planesMap = {};
            if (planes && planes.id) {
                planes.id.forEach((pid, index) => {
                    this.planesMap[pid] = planes.nombre_plan[index];
                });
            }

            this.drawUI();

        } catch (error) {
            console.error(error);
            if (!this.currentData) container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando alumnos.</p>';
        }
    },

    drawUI() {
        const container = document.getElementById('alumnos-container');
        const alumnos = this.currentData;
        if (!alumnos) return;

        let rows = '';
        if (alumnos.id && alumnos.id.length > 0) {
            // Ordenar por Apellido_y_Nombre alfabéticamente
            const sortedIndices = alumnos.id.map((_, i) => i)
                .sort((a, b) => {
                    const na = alumnos.Apellido_y_Nombre ? (alumnos.Apellido_y_Nombre[a] || '') : '';
                    const nb = alumnos.Apellido_y_Nombre ? (alumnos.Apellido_y_Nombre[b] || '') : '';
                    return na.localeCompare(nb);
                });

            for (const i of sortedIndices) {
                const planId = alumnos.plan_id ? alumnos.plan_id[i] : null;
                const planName = this.planesMap[planId] || 'Sin Plan';
                const estado = alumnos.estado ? alumnos.estado[i] : 'Activo';
                const estadoColor = estado === 'Activo' ? 'var(--success)' : 'var(--danger)';
                const displayName = alumnos.Apellido_y_Nombre ? alumnos.Apellido_y_Nombre[i] : `${alumnos.apellido[i]}, ${alumnos.nombre[i]}`;

                rows += `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 12px; font-weight: 500;">${displayName}</td>
                        <td style="padding: 12px;"><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 13px;">${planName}</span></td>
                        <td style="padding: 12px;"><span style="color: ${estadoColor}; font-weight: 600; font-size: 13px;">${estado}</span></td>
                        <td style="padding: 12px; text-align: right;">
                            <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 16px;" onclick="window.ViewAlumnos.openEditModal(${i})"><i class="ph ph-pencil-simple"></i></button>
                        </td>
                    </tr>
                `;
            }
        } else {
            rows = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay alumnos registrados</td></tr>';
        }

        const searchHtml = `
            <div style="margin-bottom: 15px; display:flex; justify-content:flex-end;">
                <div style="position:relative; width: 100%; max-width: 300px;">
                    <i class="ph ph-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                    <input type="text" id="filtro-alumnos" class="form-control" placeholder="Buscar alumno..." oninput="window.ViewAlumnos.filtrarTabla(this.value)" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding-left: 35px;">
                </div>
            </div>
        `;

        container.innerHTML = `
            ${searchHtml}
            <div class="card" style="overflow-x: auto;">
                <table id="tabla-alumnos" style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                            <th style="padding: 12px;">Alumno</th>
                            <th style="padding: 12px;">Plan</th>
                            <th style="padding: 12px;">Estado</th>
                            <th style="padding: 12px; text-align:right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    filtrarTabla(val) {
        const term = val.toLowerCase();
        const rows = document.querySelectorAll('#tabla-alumnos tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            if (text.includes(term)) row.style.display = '';
            else row.style.display = 'none';
        });
    },

    async openEditModal(index) {
        const alumnos = this.currentData;
        if (!alumnos || !alumnos.id) return;

        const id = alumnos.id[index];
        const nombre = alumnos.nombre ? alumnos.nombre[index] : '';
        const apellido = alumnos.apellido ? alumnos.apellido[index] : '';
        const dni = alumnos.dni ? alumnos.dni[index] : '';
        const email = alumnos.email ? alumnos.email[index] : '';
        let fecha_ingreso = alumnos.fecha_ingreso ? alumnos.fecha_ingreso[index] : '';
        const plan_id = alumnos.plan_id ? alumnos.plan_id[index] : '';
        const estado = alumnos.estado ? alumnos.estado[index] : 'Activo';

        if (typeof fecha_ingreso === 'number') {
            fecha_ingreso = new Date(fecha_ingreso * 1000).toISOString().split('T')[0];
        } else if (fecha_ingreso && typeof fecha_ingreso === 'string') {
            fecha_ingreso = fecha_ingreso.split('T')[0];
        }

        let options = '<option value="">Seleccionar...</option>';
        try {
            const planes = await GristData.getTable('Planes');
            if (planes && planes.id) {
                planes.id.forEach((pid, i) => {
                    const selected = pid === plan_id ? 'selected' : '';
                    options += `<option value="${pid}" ${selected}>${planes.nombre_plan[i]}</option>`;
                });
            }
        } catch (e) { }

        const formHtml = `
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="edit-al-nombre" class="form-control" value="${nombre}">
            </div>
            <div class="form-group">
                <label>Apellido</label>
                <input type="text" id="edit-al-apellido" class="form-control" value="${apellido}">
            </div>
            <div class="form-group">
                <label>DNI</label>
                <input type="text" id="edit-al-dni" class="form-control" value="${dni}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="edit-al-email" class="form-control" value="${email}">
            </div>
            <div class="form-group">
                <label>Fecha de Ingreso</label>
                <input type="date" id="edit-al-fecha" class="form-control" value="${fecha_ingreso}">
            </div>
            <div class="form-group">
                <label>Plan</label>
                <select id="edit-al-plan" class="form-control">${options}</select>
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select id="edit-al-estado" class="form-control">
                    <option value="Activo" ${estado === 'Activo' ? 'selected' : ''}>Activo</option>
                    <option value="Inactivo" ${estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
                </select>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-update-al">Actualizar</button>
        `;

        window.Modal.show('Editar Alumno', formHtml, footerHtml);

        document.getElementById('btn-update-al').addEventListener('click', async () => {
            const data = {
                nombre: document.getElementById('edit-al-nombre').value,
                apellido: document.getElementById('edit-al-apellido').value,
                dni: document.getElementById('edit-al-dni').value,
                email: document.getElementById('edit-al-email').value,
                fecha_ingreso: document.getElementById('edit-al-fecha').value,
                plan_id: parseInt(document.getElementById('edit-al-plan').value) || null,
                estado: document.getElementById('edit-al-estado').value
            };
            const btn = document.getElementById('btn-update-al');
            try {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
                btn.disabled = true;
                await GristData.updateRecord('Alumnos', id, data);
                await new Promise(r => setTimeout(r, 600));
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al actualizar el alumno');
                btn.innerHTML = 'Actualizar';
                btn.disabled = false;
            }
        });
    }
};
