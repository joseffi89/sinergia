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
        this.gastosData = GristData.getCached('Gastos_Mensuales');
        this.categoriasData = GristData.getCached('Gastos_Categorias');

        if (this.gastosData) {
            this.renderDashboard();
        } else {
            container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando gastos...</p>';
        }

        try {
            const [gastos, categorias] = await Promise.all([
                GristData.getTable('Gastos_Mensuales'),
                GristData.getTable('Gastos_Categorias')
            ]);

            this.gastosData = gastos;
            this.categoriasData = categorias;
            this.renderDashboard();

        } catch (error) {
            console.error("Error en Vista Gastos:", error);
            if (!this.gastosData) container.innerHTML = '<p style="color: var(--danger);">Error de conexión con la base de datos.</p>';
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
        let idCategoriaFijo = 1;
        if (this.categoriasData && this.categoriasData.id) {
            this.categoriasData.id.forEach((cid, i) => {
                const name = this.categoriasData.nombre_categoria[i];
                catMap[cid] = name;
                if (name === 'Fijo') idCategoriaFijo = cid;
            });
        }

        // Procesar gastos reales
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
                        isVirtual: false
                    });
                }
            }
        }

        // Inyectar Gasto Fijo: Alquiler (si no existe ya en este período)
        const existeAlquiler = gastosPeriodo.some(g => g.nombre.toLowerCase() === 'alquiler');
        if (!existeAlquiler) {
            const montoAlquiler = 1000000;
            totalPendiente += montoAlquiler;
            gastosPeriodo.push({
                id: null, // Virtual
                categoria_id: idCategoriaFijo,
                categoria: 'Fijo',
                nombre: 'Alquiler',
                monto: montoAlquiler,
                fecha_pago: null,
                isVirtual: true
            });
        }

        // Ordenar: Pendientes primero
        gastosPeriodo.sort((a, b) => {
            if (!!a.fecha_pago !== !!b.fecha_pago) return a.fecha_pago ? 1 : -1;
            return a.nombre.localeCompare(b.nombre);
        });

        const filasHtml = gastosPeriodo.map(g => {
            const isPagado = !!g.fecha_pago;
            return `
                <tr style="border-bottom: 1px solid var(--border); ${g.isVirtual ? 'opacity: 0.8;' : ''}">
                    <td style="padding: 12px;">
                        <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border); margin-right: 8px; text-transform: uppercase;">
                            ${g.categoria}
                        </span>
                        <span style="font-weight: 500;">${g.nombre} ${g.isVirtual ? '<small style="color:var(--text-muted); font-style:italic;">(Base)</small>' : ''}</span>
                    </td>
                    <td style="padding: 12px; font-weight: 600;">$${g.monto.toLocaleString()}</td>
                    <td style="padding: 12px;">
                        ${isPagado ? 
                            `<span style="color: var(--success); font-size: 13px; font-weight: 600;"><i class="ph ph-check-circle"></i> ${g.fecha_pago.split('-').reverse().join('/')}</span>` : 
                            `<span style="color: var(--danger); font-size: 13px; font-weight: 600;"><i class="ph ph-clock"></i> Impago</span>`
                        }
                    </td>
                    <td style="padding: 12px; text-align: right;">
                        ${!isPagado ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.ViewGastos.pagarGasto(${g.id}, '${g.nombre}', ${g.monto}, ${g.categoria_id})"><i class="ph ph-hand-coins"></i> Pagar</button>` : ''}
                        <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 14px;" onclick="window.ViewGastos.editarGasto(${g.id}, '${g.nombre}', ${g.monto}, ${g.categoria_id})"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 14px; color: var(--danger);" onclick="window.ViewGastos.eliminarGasto(${g.id}, ${g.isVirtual})"><i class="ph ph-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="kpi-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div class="kpi-card" style="background: var(--bg-card); border-left: 4px solid var(--success);">
                    <i class="ph ph-check-square" style="color: var(--success);"></i>
                    <div class="kpi-data">
                        <h3>Total Pagado</h3>
                        <p>$${totalPagado.toLocaleString()}</p>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); border-left: 4px solid var(--danger);">
                    <i class="ph ph-clock-afternoon" style="color: var(--danger);"></i>
                    <div class="kpi-data">
                        <h3>Total Pendiente</h3>
                        <p>$${totalPendiente.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div class="view-header" style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                <div style="display:flex; gap: 15px; align-items:center;">
                    <label style="font-size: 13px; color: var(--text-muted);">Período:</label>
                    <input type="month" id="filtro-gastos-periodo" class="form-control" value="${this.periodoActual}" onchange="window.ViewGastos.cambiarPeriodo(this.value)" style="width: auto; background: var(--bg-dark); color: white; border: 1px solid var(--border);">
                </div>
                <button class="btn btn-primary" onclick="window.ViewGastos.openNuevoGastoModal()"><i class="ph ph-plus"></i> Registrar Gasto</button>
            </div>

            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                            <th style="padding: 12px;">Concepto / Categoría</th>
                            <th style="padding: 12px;">Monto</th>
                            <th style="padding: 12px;">Estado</th>
                            <th style="padding: 12px; text-align:right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml}
                    </tbody>
                </table>
            </div>
        `;
    },

    cambiarPeriodo(periodo) {
        this.periodoActual = periodo;
        this.render();
    },

    async _asegurarGastoReal(id, nombre, monto, categoria_id) {
        if (id) return id; // Ya es real
        
        // Es virtual, crearlo en Grist
        try {
            const res = await GristData.addRecord('Gastos_Mensuales', {
                nombre_gasto: nombre,
                monto: monto,
                categoria_id: categoria_id || 1,
                periodo_mes: this.periodoActual,
                esta_pagado: false
            });
            // El ID devuelto por applyUserActions suele estar en res[0] o similar, 
            // pero para simplificar recargamos los datos
            this.gastosData = await GristData.getTable('Gastos_Mensuales');
            
            // Buscar el ID recién creado
            const newIdx = this.gastosData.id.length - 1;
            return this.gastosData.id[newIdx];
        } catch (e) {
            console.error("Error al materializar gasto virtual:", e);
            throw e;
        }
    },

    openNuevoGastoModal() {
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
                <select id="gasto-categoria" class="form-control">${catOptions}</select>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <input type="text" id="gasto-nombre" class="form-control" placeholder="Ej. Luz, Internet...">
            </div>
            <div class="form-group">
                <label>Monto ($)</label>
                <input type="number" id="gasto-monto" class="form-control" placeholder="0.00">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-gasto">Guardar</button>
        `;

        window.Modal.show('Registrar Gasto', formHtml, footerHtml);

        document.getElementById('btn-save-gasto').addEventListener('click', async () => {
            const data = {
                categoria_id: parseInt(document.getElementById('gasto-categoria').value),
                nombre_gasto: document.getElementById('gasto-nombre').value.trim(),
                monto: parseFloat(document.getElementById('gasto-monto').value),
                periodo_mes: this.periodoActual,
                esta_pagado: false
            };

            if (!data.nombre_gasto || isNaN(data.monto)) {
                alert('Complete los campos obligatorios.');
                return;
            }

            try {
                await GristData.addRecord('Gastos_Mensuales', data);
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al guardar en Grist.');
            }
        });
    },

    async pagarGasto(id, nombre, monto, catId) {
        if (!confirm(`¿Registrar pago de ${nombre} por $${monto.toLocaleString()}?`)) return;
        
        try {
            const realId = await this._asegurarGastoReal(id, nombre, monto, catId);
            const hoy = new Date().toISOString().split('T')[0];
            await GristData.updateRecord('Gastos_Mensuales', realId, {
                fecha_pago: hoy,
                esta_pagado: true
            });
            this.render();
        } catch (e) {
            alert('Error al procesar el pago.');
        }
    },

    async editarGasto(id, nombre, monto, catId) {
        const formHtml = `
            <div class="form-group">
                <label>Descripción</label>
                <input type="text" id="edit-gasto-nombre" class="form-control" value="${nombre}">
            </div>
            <div class="form-group">
                <label>Monto ($)</label>
                <input type="number" id="edit-gasto-monto" class="form-control" value="${monto}">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-update-gasto">Actualizar</button>
        `;

        window.Modal.show('Editar Gasto', formHtml, footerHtml);

        document.getElementById('btn-update-gasto').addEventListener('click', async () => {
            const newNombre = document.getElementById('edit-gasto-nombre').value.trim();
            const newMonto = parseFloat(document.getElementById('edit-gasto-monto').value);

            try {
                const realId = await this._asegurarGastoReal(id, nombre, monto, catId);
                await GristData.updateRecord('Gastos_Mensuales', realId, {
                    nombre_gasto: newNombre,
                    monto: newMonto
                });
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al actualizar.');
            }
        });
    },

    async eliminarGasto(id, isVirtual) {
        if (isVirtual) {
            alert("Este es un gasto base sugerido. Si no desea pagarlo, simplemente ignórelo.");
            return;
        }
        if (!confirm('¿Eliminar este registro de gasto?')) return;
        try {
            await GristData.deleteRecord('Gastos_Mensuales', id);
            this.render();
        } catch (e) {
            alert('Error al eliminar.');
        }
    }
};
