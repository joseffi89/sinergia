window.ViewGastos = {
    async render() {
        const container = document.getElementById('gastos-container');
        container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando gastos...</p>';

        try {
            const gastos = await GristData.getTable('Gastos_Mensuales');
            const categorias = await GristData.getTable('Gastos_Categorias');
            
            if (!gastos) {
                container.innerHTML = '<p style="color: var(--danger);">Error al cargar gastos.</p>';
                return;
            }

            // Map categorias
            const catMap = {};
            if (categorias && categorias.id) {
                categorias.id.forEach((cid, i) => {
                    catMap[cid] = categorias.nombre_categoria[i];
                });
            }

            let rows = '';
            if (gastos.id && gastos.id.length > 0) {
                for(let i=0; i < gastos.id.length; i++) {
                    const catName = catMap[gastos.categoria_id[i]] || 'General';
                    const isPagado = gastos.esta_pagado[i];
                    
                    rows += `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px; font-weight: 500;">${catName}</td>
                            <td style="padding: 12px;">${gastos.periodo_mes[i] || '-'}</td>
                            <td style="padding: 12px; font-weight: 600;">$${gastos.monto[i] || 0}</td>
                            <td style="padding: 12px;">
                                ${isPagado ? 
                                    '<span style="color: var(--success); font-weight: 500; font-size: 13px;"><i class="ph ph-check"></i> Pagado</span>' : 
                                    '<span style="color: var(--warning); font-weight: 500; font-size: 13px;"><i class="ph ph-clock"></i> Pendiente</span>'}
                            </td>
                            <td style="padding: 12px; text-align: right;">
                                <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 16px;"><i class="ph ph-pencil-simple"></i></button>
                            </td>
                        </tr>
                    `;
                }
            } else {
                rows = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay gastos registrados</td></tr>';
            }

            container.innerHTML = `
                <div class="card" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                                <th style="padding: 12px;">Categoría</th>
                                <th style="padding: 12px;">Período</th>
                                <th style="padding: 12px;">Monto</th>
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

        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando gastos.</p>';
        }
    }
};
