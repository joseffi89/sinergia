window.ViewAlumnos = {
    async render() {
        const container = document.getElementById('alumnos-container');
        container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando alumnos...</p>';

        try {
            const alumnos = await GristData.getTable('Alumnos');
            const planes = await GristData.getTable('Planes');
            
            if (!alumnos) {
                container.innerHTML = '<p style="color: var(--danger);">Error al cargar alumnos.</p>';
                return;
            }

            // Mapeo de Planes para mostrar el nombre en vez del ID
            const planesMap = {};
            if (planes && planes.id) {
                planes.id.forEach((pid, index) => {
                    planesMap[pid] = planes.nombre_plan[index];
                });
            }

            let rows = '';
            if (alumnos.id && alumnos.id.length > 0) {
                for(let i=0; i < alumnos.id.length; i++) {
                    const planId = alumnos.plan_id ? alumnos.plan_id[i] : null;
                    const planName = planesMap[planId] || 'Sin Plan';
                    const estado = alumnos.estado ? alumnos.estado[i] : 'Activo';
                    const estadoColor = estado === 'Activo' ? 'var(--success)' : 'var(--danger)';
                    const apellido = alumnos.apellido ? alumnos.apellido[i] : '-';
                    const nombre = alumnos.nombre ? alumnos.nombre[i] : '-';
                    const telefono = alumnos.telefono ? alumnos.telefono[i] : '-';
                    
                    rows += `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px; font-weight: 500;">${apellido}, ${nombre}</td>
                            <td style="padding: 12px; color: var(--text-muted);">${telefono}</td>
                            <td style="padding: 12px;"><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-size: 13px;">${planName}</span></td>
                            <td style="padding: 12px;"><span style="color: ${estadoColor}; font-weight: 600; font-size: 13px;">${estado}</span></td>
                            <td style="padding: 12px; text-align: right;">
                                <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 16px;"><i class="ph ph-pencil-simple"></i></button>
                            </td>
                        </tr>
                    `;
                }
            } else {
                rows = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay alumnos registrados</td></tr>';
            }

            const html = `
                <div class="card" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                                <th style="padding: 12px;">Alumno</th>
                                <th style="padding: 12px;">Teléfono</th>
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
            
            container.innerHTML = html;

        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando alumnos.</p>';
        }
    }
};
