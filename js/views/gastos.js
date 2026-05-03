window.ViewGastos = {
    gastosPagados: null,
    categoriasData: null,
    gastosVirtuales: [], // Solo los impagos en memoria
    periodoActual: '',

    async render() {
        const container = document.getElementById('gastos-container');
        
        if (!this.periodoActual) {
            const now = new Date();
            this.periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Cargar caché inicial
        this.gastosPagados = GristData.getCached('Gastos_Mensuales');
        this.categoriasData = GristData.getCached('Gastos_Categorias');

        if (this.gastosPagados) {
            this.renderDashboard();
        } else {
            container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando...</p>';
        }

        try {
            const [gastos, categorias] = await Promise.all([
                GristData.getTable('Gastos_Mensuales'),
                GristData.getTable('Gastos_Categorias')
            ]);

            this.gastosPagados = gastos;
            this.categoriasData = categorias;
            
            // Sincronizar los virtuales con la nueva data de Grist
            this.sincronizarGastosVirtuales();
            this.renderDashboard();

        } catch (error) {
            console.error("Error en Vista Gastos:", error);
            if (!this.gastosPagados) container.innerHTML = '<p style="color: var(--danger);">Error de conexión.</p>';
        }
    },

    sincronizarGastosVirtuales() {
        // 1. Identificar gastos fijos históricos
        const fijosHistoricos = new Map();
        let idFijo = null;
        if (this.categoriasData && this.categoriasData.id) {
            const idx = this.categoriasData.nombre_categoria.indexOf('Fijo');
            if (idx !== -1) idFijo = this.categoriasData.id[idx];
        }

        if (this.gastosPagados && this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                const catId = this.gastosPagados.categoria_id[i];
                if (catId === idFijo || (this.categoriasData && this.categoriasData.nombre_categoria[this.categoriasData.id.indexOf(catId)] === 'Fijo')) {
                    const nombre = this.gastosPagados.nombre_gasto[i];
                    const monto = parseFloat(this.gastosPagados.monto[i]) || 0;
                    fijosHistoricos.set(nombre.toLowerCase(), { nombre, monto, catId: catId || idFijo });
                }
            }
        }

        // Alquiler por defecto si no hay nada
        if (fijosHistoricos.size === 0) {
            fijosHistoricos.set('alquiler', { nombre: 'Alquiler', monto: 1000000, catId: idFijo || 1 });
        }

        // 2. Ver lo que ya está pagado en este mes
        const pagadosEsteMes = new Set();
        if (this.gastosPagados && this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                if (this.gastosPagados.periodo_mes[i] === this.periodoActual) {
                    pagadosEsteMes.add(this.gastosPagados.nombre_gasto[i].toLowerCase());
                }
            }
        }

        // 3. Reconstruir lista de virtuales
        // Mantener los temporales que el usuario agregó manualmente
        const manualesTemporales = this.gastosVirtuales.filter(v => v.categoria !== 'Fijo');
        
        // Generar los fijos que falten pagar
        const fijosFaltantes = [];
        fijosHistoricos.forEach((data, nombreKey) => {
            if (!pagadosEsteMes.has(nombreKey)) {
                fijosFaltantes.push({
                    tempId: 'fix-' + nombreKey,
                    nombre: data.nombre,
                    monto: data.monto,
                    categoria: 'Fijo',
                    categoria_id: data.catId
                });
            }
        });

        // La lista final son los fijos faltantes + los manuales (que no hayan sido pagados ya)
        const temporalesNoPagados = manualesTemporales.filter(m => !pagadosEsteMes.has(m.nombre.toLowerCase()));
        
        this.gastosVirtuales = [...fijosFaltantes, ...temporalesNoPagados];
    },

    renderDashboard() {
        const container = document.getElementById('gastos-container');
        if (!this.gastosPagados) return;

        let totalPagado = 0;
        let totalPendiente = 0;
        const listaFinal = [];

        const catMap = {};
        if (this.categoriasData && this.categoriasData.id) {
            this.categoriasData.id.forEach((cid, i) => {
                catMap[cid] = this.categoriasData.nombre_categoria[i];
            });
        }

        // Pagados (Desde Grist)
        if (this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                if (this.gastosPagados.periodo_mes[i] === this.periodoActual) {
                    const monto = parseFloat(this.gastosPagados.monto[i]) || 0;
                    totalPagado += monto;
                    listaFinal.push({
                        id: this.gastosPagados.id[i],
                        nombre: this.gastosPagados.nombre_gasto[i],
                        monto: monto,
                        categoria: catMap[this.gastosPagados.categoria_id[i]] || 'General',
                        fecha_pago: this.gastosPagados.fecha_pago[i],
                        estado: 'Pagado'
                    });
                }
            }
        }

        // Pendientes (Desde memoria)
        this.gastosVirtuales.forEach(gv => {
            totalPendiente += gv.monto;
            listaFinal.push({
                tempId: gv.tempId,
                nombre: gv.nombre,
                monto: gv.monto,
                categoria: gv.categoria,
                categoria_id: gv.categoria_id,
                fecha_pago: null,
                estado: 'Impago'
            });
        });

        listaFinal.sort((a, b) => (a.estado === 'Impago' ? -1 : 1));

        const filasHtml = listaFinal.map(g => `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px;">
                    <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border); margin-right: 8px;">
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
                    ${g.estado === 'Impago' ? `
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.ViewGastos.confirmarPagoVirtual('${g.tempId}')"><i class="ph ph-hand-coins"></i> Pagar</button>
                        <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 14px;" onclick="window.ViewGastos.editarVirtual('${g.tempId}')"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 14px; color: var(--danger);" onclick="window.ViewGastos.eliminarVirtual('${g.tempId}')"><i class="ph ph-trash"></i></button>
                    ` : `
                        <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 14px; color: var(--danger);" onclick="window.ViewGastos.eliminarReal(${g.id})"><i class="ph ph-trash"></i></button>
                    `}
                </td>
            </tr>
        `).join('');

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
                    <input type="month" id="filtro-gastos-periodo" class="form-control" value="${this.periodoActual}" onchange="window.ViewGastos.cambiarPeriodo(this.value)" style="width: auto; background: var(--bg-dark); color: white; border: 1px solid var(--border);">
                </div>
                <button class="btn btn-primary" onclick="window.ViewGastos.openNuevoGastoModal()"><i class="ph ph-plus"></i> Registrar Gasto</button>
            </div>

            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 12px; text-transform: uppercase;">
                            <th style="padding: 12px;">Concepto</th>
                            <th style="padding: 12px;">Monto</th>
                            <th style="padding: 12px;">Estado</th>
                            <th style="padding: 12px; text-align:right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml || '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">Sin movimientos</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    },

    cambiarPeriodo(periodo) {
        this.periodoActual = periodo;
        this.gastosVirtuales = []; // Reiniciar para que se sincronicen los fijos del nuevo periodo
        this.render();
    },

    openNuevoGastoModal() {
        const formHtml = `
            <div class="form-group">
                <label>Categoría</label>
                <select id="gasto-categoria" class="form-control">
                    <option value="Fijo">Fijo</option>
                    <option value="Temporal" selected>Temporal</option>
                </select>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <input type="text" id="gasto-nombre" class="form-control" placeholder="Ej. Luz, Internet...">
            </div>
            <div class="form-group">
                <label>Monto ($)</label>
                <input type="number" id="gasto-monto" class="form-control" placeholder="0">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-add-virtual">Agregar a la lista</button>
        `;

        window.Modal.show('Nuevo Gasto (Pendiente)', formHtml, footerHtml);

        document.getElementById('btn-add-virtual').addEventListener('click', () => {
            const nombre = document.getElementById('gasto-nombre').value.trim();
            const monto = parseFloat(document.getElementById('gasto-monto').value);
            const categoria = document.getElementById('gasto-categoria').value;

            if (!nombre || isNaN(monto)) return alert('Complete los datos.');

            let catId = categoria;
            if (categoria === 'Fijo' && this.categoriasData && this.categoriasData.id) {
                const idx = this.categoriasData.nombre_categoria.indexOf('Fijo');
                if (idx !== -1) catId = this.categoriasData.id[idx];
            } else if (categoria === 'Temporal' && this.categoriasData && this.categoriasData.id) {
                const idx = this.categoriasData.nombre_categoria.indexOf('Temporal');
                if (idx !== -1) catId = this.categoriasData.id[idx];
            }

            this.gastosVirtuales.push({
                tempId: Date.now(),
                nombre,
                monto,
                categoria,
                categoria_id: catId
            });

            window.Modal.close();
            this.renderDashboard(); // Render inmediato de la tabla
        });
    },

    editarVirtual(tempId) {
        const g = this.gastosVirtuales.find(v => v.tempId === tempId);
        if (!g) return;

        const formHtml = `
            <div class="form-group">
                <label>Descripción</label>
                <input type="text" id="edit-v-nombre" class="form-control" value="${g.nombre}">
            </div>
            <div class="form-group">
                <label>Monto ($)</label>
                <input type="number" id="edit-v-monto" class="form-control" value="${g.monto}">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-update-virtual">Actualizar</button>
        `;

        window.Modal.show('Editar Gasto Pendiente', formHtml, footerHtml);

        document.getElementById('btn-update-virtual').addEventListener('click', () => {
            g.nombre = document.getElementById('edit-v-nombre').value.trim();
            g.monto = parseFloat(document.getElementById('edit-v-monto').value);
            window.Modal.close();
            this.renderDashboard();
        });
    },

    eliminarVirtual(tempId) {
        this.gastosVirtuales = this.gastosVirtuales.filter(v => v.tempId !== tempId);
        this.renderDashboard();
    },

    async confirmarPagoVirtual(tempId) {
        const g = this.gastosVirtuales.find(v => v.tempId === tempId);
        if (!g) return;

        if (!confirm(`¿Confirmar pago de "${g.nombre}" por $${g.monto.toLocaleString()}?`)) return;

        const data = {
            categoria_id: g.categoria_id || g.categoria,
            nombre_gasto: g.nombre,
            periodo_mes: this.periodoActual,
            monto: g.monto,
            fecha_pago: new Date().toISOString().split('T')[0]
        };

        try {
            await GristData.addRecord('Gastos_Mensuales', data);
            
            // Forzar actualización inmediata de datos
            this.gastosPagados = await GristData.getTable('Gastos_Mensuales');
            
            // Sincronizar virtuales (esto eliminará el que acabamos de pagar de la lista virtual)
            this.sincronizarGastosVirtuales();
            
            this.renderDashboard();
            alert('Pago registrado con éxito.');
        } catch (e) {
            console.error(e);
            alert('Error al guardar en Grist. Verifique los permisos o campos.');
        }
    },

    async eliminarReal(id) {
        if (!confirm('¿Eliminar este registro permanente de Grist?')) return;
        try {
            await GristData.deleteRecord('Gastos_Mensuales', id);
            this.gastosPagados = await GristData.getTable('Gastos_Mensuales');
            this.sincronizarGastosVirtuales();
            this.renderDashboard();
        } catch (e) {
            alert('Error al eliminar de Grist.');
        }
    }
};
