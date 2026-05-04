window.ViewGastos = {
    gastosPagados: null,
    categoriasData: null,
    // Estructura: { 'YYYY-MM': [ {tempId, nombre, monto, categoria, ...}, ... ] }
    gastosVirtualesPorMes: {},
    periodoActual: '',

    async render() {
        const container = document.getElementById('gastos-container');
        
        if (!this.periodoActual) {
            const now = new Date();
            this.periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Cargar caché
        this.gastosPagados = GristData.getCached('Gastos_Mensuales');
        this.categoriasData = GristData.getCached('Gastos_Categorias');

        if (this.gastosPagados) {
            this.sincronizarGastosVirtuales();
            this.renderDashboard();
        } else {
            container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando datos...</p>';
        }

        try {
            const [gastos, categorias] = await Promise.all([
                GristData.getTable('Gastos_Mensuales'),
                GristData.getTable('Gastos_Categorias')
            ]);

            this.gastosPagados = gastos;
            this.categoriasData = categorias;
            
            this.sincronizarGastosVirtuales();
            this.renderDashboard();

        } catch (error) {
            console.error("Error en Vista Gastos:", error);
            if (!this.gastosPagados) container.innerHTML = '<p style="color: var(--danger);">Error al conectar con Grist.</p>';
        }
    },

    sincronizarGastosVirtuales() {
        const mes = this.periodoActual;
        
        // 1. Identificar gastos fijos históricos (buscamos en todos los meses pasados)
        const fijosHistoricos = new Map();
        let idFijo = null;
        if (this.categoriasData && this.categoriasData.id) {
            const idx = this.categoriasData.nombre_categoria.indexOf('Fijo');
            if (idx !== -1) idFijo = this.categoriasData.id[idx];
        }

        if (this.gastosPagados && this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                const catId = this.gastosPagados.categoria_id[i];
                const isFijo = (catId === idFijo) || 
                               (this.categoriasData && this.categoriasData.nombre_categoria[this.categoriasData.id.indexOf(catId)] === 'Fijo');
                
                if (isFijo) {
                    const nombre = (this.gastosPagados.nombre_gasto[i] || '').trim();
                    const monto = parseFloat(this.gastosPagados.monto[i]) || 0;
                    if (nombre) {
                        fijosHistoricos.set(nombre.toLowerCase(), { nombre, monto, catId: catId || idFijo });
                    }
                }
            }
        }

        // Alquiler por defecto si no hay nada en el historial
        if (fijosHistoricos.size === 0) {
            fijosHistoricos.set('alquiler', { nombre: 'Alquiler', monto: 1000000, catId: idFijo || 1 });
        }

        // 2. Identificar qué gastos ya están pagados EN ESTE MES
        const pagadosEsteMes = new Set();
        if (this.gastosPagados && this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                if (this.gastosPagados.periodo_mes[i] === mes && this.gastosPagados.fecha_pago[i]) {
                    pagadosEsteMes.add((this.gastosPagados.nombre_gasto[i] || '').trim().toLowerCase());
                }
            }
        }

        // 3. Obtener o inicializar la lista virtual de este mes
        if (!this.gastosVirtualesPorMes[mes]) {
            this.gastosVirtualesPorMes[mes] = [];
        }

        // 4. Agregar los fijos históricos que falten en este mes
        fijosHistoricos.forEach((data, nombreKey) => {
            const yaEstaEnVirtual = this.gastosVirtualesPorMes[mes].some(v => v.nombre.toLowerCase() === nombreKey);
            const yaEstaEnPagados = pagadosEsteMes.has(nombreKey);

            if (!yaEstaEnVirtual && !yaEstaEnPagados) {
                this.gastosVirtualesPorMes[mes].push({
                    tempId: 'fix-' + nombreKey + '-' + mes,
                    nombre: data.nombre,
                    monto: data.monto,
                    categoria: 'Fijo',
                    categoria_id: data.catId
                });
            }
        });

        // 5. Limpieza: si un gasto virtual ahora figura como pagado en Grist, lo removemos de virtuales
        this.gastosVirtualesPorMes[mes] = this.gastosVirtualesPorMes[mes].filter(v => {
            return !pagadosEsteMes.has(v.nombre.toLowerCase());
        });
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

        // Pendientes (Desde la lista virtual de este mes)
        const virtualesEsteMes = this.gastosVirtualesPorMes[this.periodoActual] || [];
        virtualesEsteMes.forEach(gv => {
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

            <div class="view-header" style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap: 15px; align-items:center;">
                    <input type="month" id="filtro-gastos-periodo" class="form-control" value="${this.periodoActual}" onchange="window.ViewGastos.cambiarPeriodo(this.value)" style="width: auto; background: var(--bg-card); color: white; border: 1px solid var(--border);">
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
            if (this.categoriasData && this.categoriasData.id) {
                const idx = this.categoriasData.nombre_categoria.indexOf(categoria);
                if (idx !== -1) catId = this.categoriasData.id[idx];
            }

            const mes = this.periodoActual;
            if (!this.gastosVirtualesPorMes[mes]) this.gastosVirtualesPorMes[mes] = [];
            
            this.gastosVirtualesPorMes[mes].push({
                tempId: Date.now() + '-' + mes,
                nombre,
                monto,
                categoria,
                categoria_id: catId
            });

            window.Modal.close();
            this.renderDashboard();
        });
    },

    editarVirtual(tempId) {
        const mes = this.periodoActual;
        const lista = this.gastosVirtualesPorMes[mes] || [];
        const g = lista.find(v => v.tempId === tempId);
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
        const mes = this.periodoActual;
        if (this.gastosVirtualesPorMes[mes]) {
            this.gastosVirtualesPorMes[mes] = this.gastosVirtualesPorMes[mes].filter(v => v.tempId !== tempId);
        }
        this.renderDashboard();
    },

    async confirmarPagoVirtual(tempId) {
        const mes = this.periodoActual;
        const lista = this.gastosVirtualesPorMes[mes] || [];
        const g = lista.find(v => v.tempId === tempId);
        if (!g) return;

        if (!confirm(`¿Confirmar pago de "${g.nombre}" por $${g.monto.toLocaleString()}?`)) return;

        const data = {
            categoria_id: g.categoria_id || g.categoria,
            nombre_gasto: g.nombre,
            periodo_mes: mes,
            monto: g.monto,
            fecha_pago: new Date().toISOString().split('T')[0]
        };

        try {
            await GristData.addRecord('Gastos_Mensuales', data);
            
            // Forzar actualización inmediata de datos de Grist
            this.gastosPagados = await GristData.getTable('Gastos_Mensuales');
            
            // Al sincronizar, se detectará que el nombre ahora está en pagados y se removerá del virtual automáticamente
            this.sincronizarGastosVirtuales();
            this.renderDashboard();
            
            alert('Pago registrado con éxito.');
        } catch (e) {
            console.error(e);
            alert('Error al guardar en Grist.');
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
