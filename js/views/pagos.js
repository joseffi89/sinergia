window.ViewPagos = {
    async render() {
        const listContainer = document.getElementById('pagos-list');
        listContainer.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando pagos...</p>';

        try {
            const pagos = await GristData.getTable('Pagos');
            const alumnos = await GristData.getTable('Alumnos');
            
            if (!pagos || !alumnos) {
                listContainer.innerHTML = '<p style="color: var(--danger);">Error al cargar datos de pagos.</p>';
                return;
            }

            // Map alumnos
            const alumnosMap = {};
            if (alumnos.id) {
                alumnos.id.forEach((aid, i) => {
                    alumnosMap[aid] = `${alumnos.apellido[i]}, ${alumnos.nombre[i]}`;
                });
            }

            let totalCobrado = 0;
            let totalACobrar = 0;
            let activosCount = 0; // Se debería sacar filtrando alumnos activos, pero simplificaremos acá

            if (alumnos.estado) {
                activosCount = alumnos.estado.filter(e => e === 'Activo').length;
            }

            let rows = '';
            if (pagos.id && pagos.id.length > 0) {
                for(let i=0; i < pagos.id.length; i++) {
                    const alumnoName = alumnosMap[pagos.alumno_id[i]] || 'Desconocido';
                    const importe = pagos.importe_plan[i] || 0;
                    const pagado = pagos.monto_pagado[i] || 0;
                    
                    totalACobrar += importe;
                    totalCobrado += pagado;

                    const status = pagos.status_pago[i];
                    let statusColor = 'var(--text-muted)';
                    if(status === 'Pagado') statusColor = 'var(--success)';
                    if(status === 'Vencido') statusColor = 'var(--danger)';
                    if(status === 'Próximo a Vencer') statusColor = 'var(--warning)';

                    rows += `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px; font-weight: 500;">${alumnoName}</td>
                            <td style="padding: 12px;">${pagos.periodo_mes[i] || '-'}</td>
                            <td style="padding: 12px;">$${importe}</td>
                            <td style="padding: 12px;">$${pagado}</td>
                            <td style="padding: 12px;"><span style="color: ${statusColor}; font-weight: 600; font-size: 13px;"><i class="ph ph-circle-fill" style="font-size:8px; vertical-align:middle;"></i> ${status}</span></td>
                            <td style="padding: 12px; text-align: right;">
                                ${status !== 'Pagado' ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;">Cobrar</button>` : `<span style="color: var(--success); font-size: 12px; font-weight:600;"><i class="ph ph-check-circle"></i> OK</span>`}
                            </td>
                        </tr>
                    `;
                }
            } else {
                rows = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay pagos registrados</td></tr>';
            }

            // Update KPIs
            document.getElementById('kpi-activos').textContent = activosCount;
            document.getElementById('kpi-cobrar').textContent = `$${totalACobrar}`;
            document.getElementById('kpi-cobrado').textContent = `$${totalCobrado}`;

            listContainer.innerHTML = `
                <div class="card" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                                <th style="padding: 12px;">Alumno</th>
                                <th style="padding: 12px;">Período</th>
                                <th style="padding: 12px;">Importe</th>
                                <th style="padding: 12px;">Pagado</th>
                                <th style="padding: 12px;">Estado</th>
                                <th style="padding: 12px; text-align:right;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            console.error(error);
            listContainer.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando pagos.</p>';
        }
    }
};
