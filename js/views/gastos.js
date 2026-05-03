window.ViewGastos = {
    gastosData: null,
    categoriasData: null,
    periodoActual: '',

    async render() {
        const container = document.getElementById('gastos-container');
        
        if (!this.periodoActual) {
            const now = new Date();
            this.periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Usar caché para render inmediato
        if (!this.gastosData) {
            this.gastosData = GristData.getCached('Gastos_Mensuales');
            this.categoriasData = GristData.getCached('Gastos_Categorias');
        }

        if (this.gastosData) {
            this.renderDashboard();
        } else {
            container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando gastos...</p>';
        }

        try {
            // Actualización en segundo plano
            const [gastos, categorias] = await Promise.all([
                GristData.getTable('Gastos_Mensuales'),
                GristData.getTable('Gastos_Categorias')
            ]);

            this.gastosData = gastos;
            this.categoriasData = categorias;
            this.renderDashboard();

        } catch (error) {
            console.error("Error en Vista Gastos:", error);
            if (!this.gastosData) container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando gastos.</p>';
        }
    },

    renderDashboard() {
        const container = document.getElementById('gastos-container');
        if (!this.gastosData) return;

        let totalPagado = 0;
        let totalPendiente = 0;
        const gastosPeriodo = [];

        // Map categorias
        const catMap = {};
        if (this.categoriasData && this.categoriasData.id) {
            this.categoriasData.id.forEach((cid, i) => {
                catMap[cid] = this.categoriasData.nombre_categoria[i];
            });
        }

        if (this.gastosData.id) {
            for (let i = 0; i < this.gastosData.id.length; i++) {
                if (this.gastosData.periodo_mes[i] === this.periodoActual) {
                    const monto = parseFloat(this.gastosData.monto[i]) || 0;
                    const pagado = this.gastosData.fecha_pago && this.gastosData.fecha_pago[i];
                    
                    if (pagado) totalPagado += monto;
                    else totalPendiente += monto;

                    gastosPeriodo.push({
                        id: this.gastosData.id[i],
                        categoria_id: this.gastosData.categoria_id[i],
                        categoria: catMap[this.gastosData.categoria_id[i]] || 'General',
                        nombre: this.gastosData.nombre_gasto[i] || 'Sin nombre',
                        monto: monto,
                        fecha_pago: pagado,
                        estado: pagado ? 'Pagado' : 'Impago'
                    });
                }
            }
        }

        // Ordenar: Impagos primero, luego por nombre
        gastosPeriodo.sort((a, b) => {
            if (a.estado !== b.estado) return a.estado === 'Impago' ? -1 : 1;
            return a.nombre.localeCompare(b.nombre);
        });

        const filasHtml = gastosPeriodo.map(g => `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px;">
                    <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border); margin-right: 8px;">
                        ${g.categoria}
                    </span>
                    <span style="font-weight: 500;">${g.nombre}</span>
                </td>
                <td style="padding: 12px; font-weight: 600;">$${g.monto.toLocaleString()}</td>
                <td style="padding: 12px;">
                    ${g.fecha_pago ? 
                        `<span style="color: var(--success); font-size: 13px; font-weight: 600;"><i class="ph ph-check-circle"></i> ${g.fecha_pago.split('-').reverse().join('/')}</span>` : 
                        `<span style="color: var(--danger); font-size: 13px; font-weight: 600;"><i class="ph ph-clock"></i> Impago</span>`
                    }
                </td>
                <td style="padding: 12px; text-align: right;">
                    ${!g.fecha_pago ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.ViewGastos.pagarGasto(${g.id}, '${g.nombre}', ${g.monto})"><i class="ph ph-hand-coins"></i> Pagar</button>` : ''}
                    <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 14px;" onclick="window.ViewGastos.editarGasto(${g.id}, '${g.nombre}', ${g.monto})"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 14px; color: var(--danger);" onclick="window.ViewGastos.eliminarGasto(${g.id})"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');

        const emptyMessage = `
            <tr>
                <td colspan="4" style="text-align:center; padding: 40px; color: var(--text-muted);">
                    <i class="ph ph-receipt" style="font-size: 48px; display:block; margin: 0 auto 10px; opacity: 0.3;"></i>
                    No hay gastos registrados para este período.<br>
                    <button class="btn btn-secondary" style="margin-top: 15px;" onclick="window.ViewGastos.cargarGastosFijos()">
                        <i class="ph ph-magic-wand"></i> Cargar Gastos Fijos (Alquiler)
                    </button>
                </td>
            </tr>
        `;

        container.innerHTML = `
            <div class="kpi-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="kpi-card" style="background: var(--bg-card); border-left: 4px solid var(--success);">
                    <i class="ph ph-check-square" style="color: var(--success);"></i>
                    <div class="kpi-data">
                        <h3>Pagado</h3>
                        <p id="kpi-gastos-pagado">$${totalPagado.toLocaleString()}</p>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); border-left: 4px solid var(--danger);">
                    <i class="ph ph-clock-afternoon" style="color: var(--danger);"></i>
                    <div class="kpi-data">
                        <h3>Pendiente</h3>
                        <p id="kpi-gastos-pendiente">$${totalPendiente.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div class="view-header" style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap: 15px; align-items:center;">
                    <input type="month" id="filtro-gastos-periodo" class="form-control" value="${this.periodoActual}" onchange="window.ViewGastos.cambiarPeriodo(this.value)" style="width: auto; background: var(--bg-card); color: white; border: 1px solid var(--border);">
                </div>
                <button class="btn btn-primary" onclick="window.ViewGastos.openNuevoGastoModal()"><i class="ph ph-plus"></i> Registrar Gasto</button>
            </div>

            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                            <th style="padding: 12px;">Gasto / Categoría</th>
                            <th style="padding: 12px;">Importe</th>
                            <th style="padding: 12px;">Estado</th>
                            <th style="padding: 12px; text-align:right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml || emptyMessage}
                    </tbody>
                </table>
            </div>
        `;
    },

    cambiarPeriodo(periodo) {
        this.periodoActual = periodo;
        this.render();
    },

    openNuevoGastoModal() {
        // Categorias options
        let catOptions = '';
        if (this.categoriasData && this.categoriasData.id) {
            this.categoriasData.id.forEach((id, i) => {
                catOptions += `<option value="${id}">${this.categoriasData.nombre_categoria[i]}</option>`;
            });
        } else {
            catOptions = '<option value="1">Fijo</option><option value="2">Temporal</option>';
        }

        const formHtml = `
            <div class="form-group">
                <label>Categoría</label>
                <select id="gasto-categoria" class="form-control">
                    ${catOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Descripción del Gasto</label>
                <input type="text" id="gasto-nombre" class="form-control" placeholder="Ej. Alquiler, Luz, Insumos...">
            </div>
            <div class="form-group">
                <label>Importe ($)</label>
                <input type="number" id="gasto-monto" class="form-control" placeholder="0.00">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-gasto">Guardar Gasto</button>
        `;

        window.Modal.show('Nuevo Gasto', formHtml, footerHtml);

        document.getElementById('gasto-categoria').addEventListener('change', (e) => {
            const nombreInput = document.getElementById('gasto-nombre');
            const montoInput = document.getElementById('gasto-monto');
            // Si elige Fijo (asumimos ID 1 o texto Fijo), sugerir Alquiler
            if (e.target.options[e.target.selectedIndex].text === 'Fijo') {
                if (!nombreInput.value) nombreInput.value = 'Alquiler';
                if (!montoInput.value) montoInput.value = 1000000;
            }
        });

        document.getElementById('btn-save-gasto').addEventListener('click', async () => {
            const data = {
                categoria_id: parseInt(document.getElementById('gasto-categoria').value),
                nombre_gasto: document.getElementById('gasto-nombre').value,
                monto: parseFloat(document.getElementById('gasto-monto').value),
                periodo_mes: this.periodoActual,
                esta_pagado: false
            };

            if (!data.nombre_gasto || isNaN(data.monto)) {
                alert('Complete todos los campos obligatorios.');
                return;
            }

            try {
                await GristData.addRecord('Gastos_Mensuales', data);
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al guardar el gasto');
            }
        });
    },

    async pagarGasto(id, nombre, monto) {
        if (!confirm(`¿Confirmar pago de "${nombre}" por $${monto}?`)) return;
        
        const hoy = new Date().toISOString().split('T')[0];
        try {
            await GristData.updateRecord('Gastos_Mensuales', id, {
                fecha_pago: hoy,
                esta_pagado: true
            });
            this.render();
        } catch (e) {
            alert('Error al registrar el pago');
        }
    },

    editarGasto(id, nombre, montoActual) {
        const formHtml = `
            <div class="form-group">
                <label>Descripción del Gasto</label>
                <input type="text" id="edit-gasto-nombre" class="form-control" value="${nombre}">
            </div>
            <div class="form-group">
                <label>Importe ($)</label>
                <input type="number" id="edit-gasto-monto" class="form-control" value="${montoActual}">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-update-gasto">Actualizar</button>
        `;

        window.Modal.show('Editar Gasto', formHtml, footerHtml);

        document.getElementById('btn-update-gasto').addEventListener('click', async () => {
            const data = {
                nombre_gasto: document.getElementById('edit-gasto-nombre').value,
                monto: parseFloat(document.getElementById('edit-gasto-monto').value)
            };

            try {
                await GristData.updateRecord('Gastos_Mensuales', id, data);
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al actualizar');
            }
        });
    },

    async eliminarGasto(id) {
        if (!confirm('¿Seguro que desea eliminar este gasto?')) return;
        try {
            await GristData.deleteRecord('Gastos_Mensuales', id);
            this.render();
        } catch (e) {
            alert('Error al eliminar');
        }
    },

    async cargarGastosFijos() {
        // En un escenario real, esto vendría de una tabla Gastos_Base
        // Por ahora cargamos el Alquiler como pidió el usuario
        const data = {
            categoria_id: 1, // Fijo
            nombre_gasto: 'Alquiler',
            monto: 1000000,
            periodo_mes: this.periodoActual,
            esta_pagado: false
        };

        try {
            await GristData.addRecord('Gastos_Mensuales', data);
            this.render();
        } catch (e) {
            alert('Error al cargar gastos fijos');
        }
    }
};
