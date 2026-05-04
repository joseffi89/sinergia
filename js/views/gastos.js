window.ViewGastos = {
    gastosPagados: null,
    categoriasData: null,
    
    pendientesPorMes: {}, // { '2026-05': [ {tempId, baseNombre, nombre, monto, categoria, ...} ] }
    borradosPorMes: {},   // { '2026-05': Set('alquiler', 'luz') }
    fijosNuevosGlobal: [],// [ {baseNombre, nombre, monto, catId} ]
    
    periodoActual: '',

    async render() {
        const container = document.getElementById('gastos-container');
        
        if (!this.periodoActual) {
            const now = new Date();
            this.periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        this.gastosPagados = GristData.getCached('Gastos_Mensuales');
        this.categoriasData = GristData.getCached('Gastos_Categorias');

        if (this.gastosPagados) {
            this.sincronizarGastosVirtuales();
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
            
            this.sincronizarGastosVirtuales();
            this.renderDashboard();

        } catch (error) {
            console.error("Error en Vista Gastos:", error);
            if (!this.gastosPagados) container.innerHTML = '<p style="color: var(--danger);">Error de conexión.</p>';
        }
    },

    _esMismoMes(pGrist, pActual) {
        if (!pGrist) return false;
        const pg = String(pGrist).trim().toLowerCase();
        const pa = String(pActual).trim().toLowerCase();
        
        if (pg === pa) return true;
        if (pg.replace(/-0/g, '-') === pa.replace(/-0/g, '-')) return true;
        if (pg.startsWith(pa)) return true;
        
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const mesesShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const [anio, mesNum] = pa.split('-');
        const idx = parseInt(mesNum) - 1;
        const nombreMes = meses[idx];
        const nombreMesShort = mesesShort[idx];
        
        if (pg.includes(nombreMes) || pg.includes(nombreMesShort)) {
            if (pg.includes(anio)) return true;
            if (!pg.match(/\d{4}/)) return true; 
        }

        return false;
    },

    sincronizarGastosVirtuales() {
        const mes = this.periodoActual;
        
        if (!this.pendientesPorMes[mes]) this.pendientesPorMes[mes] = [];
        if (!this.borradosPorMes[mes]) this.borradosPorMes[mes] = new Set();

        const pendientes = this.pendientesPorMes[mes];
        const borrados = this.borradosPorMes[mes];

        const catMap = {}; 
        let idFijo = null;
        if (this.categoriasData && this.categoriasData.id) {
            this.categoriasData.id.forEach((cid, i) => {
                const name = this.categoriasData.nombre_categoria[i];
                catMap[cid] = name;
                if (name === 'Fijo') idFijo = cid;
            });
        }

        // 1. Identificar Pagos del mes y Fijos históricos
        const pagadosEsteMes = new Set();
        const fijosHistoricos = new Map();

        if (this.gastosPagados && this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                const pGrist = this.gastosPagados.periodo_mes[i];
                const cId = this.gastosPagados.categoria_id[i];
                const nombre = (this.gastosPagados.nombre_gasto[i] || '').trim();
                const monto = parseFloat(this.gastosPagados.monto[i]) || 0;
                const baseNombre = nombre.toLowerCase();
                
                // Si es fijo, guardar en históricos
                if (cId === idFijo || catMap[cId] === 'Fijo') {
                    if (nombre) fijosHistoricos.set(baseNombre, { nombre, monto, catId: cId || idFijo });
                }

                // Si está pagado este mes
                if (this._esMismoMes(pGrist, mes)) {
                    pagadosEsteMes.add(baseNombre);
                }
            }
        }

        // 2. Agregar fijos nuevos globales a los históricos (para que se propaguen)
        this.fijosNuevosGlobal.forEach(f => {
            fijosHistoricos.set(f.baseNombre, f);
        });

        // 3. Alquiler por defecto si no hay fijos
        if (fijosHistoricos.size === 0) {
            fijosHistoricos.set('alquiler', { nombre: 'Alquiler', monto: 1000000, catId: idFijo || 1 });
        }

        // 4. Limpiar pendientes que ya fueron pagados en Grist
        this.pendientesPorMes[mes] = pendientes.filter(p => !pagadosEsteMes.has(p.baseNombre));

        // 5. Inyectar fijos históricos faltantes
        fijosHistoricos.forEach((data, baseNombre) => {
            const noEstaPagado = !pagadosEsteMes.has(baseNombre);
            const noEstaBorrado = !borrados.has(baseNombre);
            const noEstaEnVirtual = !this.pendientesPorMes[mes].some(p => p.baseNombre === baseNombre);

            if (noEstaPagado && noEstaBorrado && noEstaEnVirtual) {
                this.pendientesPorMes[mes].push({
                    tempId: 'virt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    baseNombre: baseNombre,
                    nombre: data.nombre,
                    monto: data.monto,
                    categoria: 'Fijo',
                    categoria_id: data.catId
                });
            }
        });
    },

    renderDashboard() {
        const container = document.getElementById('gastos-container');
        if (!this.gastosPagados) return;

        const mes = this.periodoActual;
        let totalPagado = 0;
        let totalPendiente = 0;
        const listaFinal = [];

        const catMap = {}; 
        if (this.categoriasData && this.categoriasData.id) {
            this.categoriasData.id.forEach((cid, i) => {
                catMap[cid] = this.categoriasData.nombre_categoria[i];
            });
        }

        // 1. Mostrar pagados
        if (this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                const pGrist = this.gastosPagados.periodo_mes[i];
                if (this._esMismoMes(pGrist, mes)) {
                    const monto = parseFloat(this.gastosPagados.monto[i]) || 0;
                    totalPagado += monto;
                    listaFinal.push({
                        id: this.gastosPagados.id[i],
                        nombre: this.gastosPagados.nombre_gasto[i],
                        monto: monto,
                        categoria: catMap[this.gastosPagados.categoria_id[i]] || 'General',
                        fecha_pago: this.gastosPagados.fecha_pago ? this.gastosPagados.fecha_pago[i] : null,
                        estado: 'Pagado' // Forzamos visualmente a Pagado porque está en Grist
                    });
                }
            }
        }

        // 2. Mostrar pendientes
        const pendientes = this.pendientesPorMes[mes] || [];
        pendientes.forEach(p => {
            totalPendiente += p.monto;
            listaFinal.push({
                ...p,
                fecha_pago: null,
                estado: 'Impago'
            });
        });

        // Ordenar
        listaFinal.sort((a, b) => {
            if (a.estado !== b.estado) return a.estado === 'Impago' ? -1 : 1;
            return a.nombre.localeCompare(b.nombre);
        });

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
                    ${g.estado === 'Pagado' ? 
                        `<span style="color: var(--success); font-size: 13px; font-weight: 600;"><i class="ph ph-check-circle"></i> ${g.fecha_pago ? g.fecha_pago.split('-').reverse().join('/') : 'Pagado'}</span>` : 
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
        this.sincronizarGastosVirtuales();
        this.renderDashboard();
    },

    openNuevoGastoModal() {
        const formHtml = `
            <div class="form-group">
                <label>Categoría</label>
                <select id="gasto-categoria" class="form-control">
                    <option value="Fijo">Fijo (Mensual)</option>
                    <option value="Temporal" selected>Temporal (Solo este mes)</option>
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

            let catId = 2; 
            if (this.categoriasData && this.categoriasData.id) {
                const idx = this.categoriasData.nombre_categoria.indexOf(categoria);
                if (idx !== -1) catId = this.categoriasData.id[idx];
            }

            const item = {
                tempId: 'virt-' + Date.now(),
                baseNombre: nombre.toLowerCase(),
                nombre,
                monto,
                categoria,
                categoria_id: catId
            };

            const mes = this.periodoActual;
            if (!this.pendientesPorMes[mes]) this.pendientesPorMes[mes] = [];
            this.pendientesPorMes[mes].push(item);

            // Si es fijo, propagar a la memoria global
            if (categoria === 'Fijo') {
                this.fijosNuevosGlobal.push({
                    baseNombre: nombre.toLowerCase(),
                    nombre,
                    monto,
                    catId
                });
            }

            window.Modal.close();
            this.renderDashboard();
        });
    },

    editarVirtual(tempId) {
        const mes = this.periodoActual;
        const item = this.pendientesPorMes[mes].find(v => v.tempId === tempId);
        if (!item) return;

        const formHtml = `
            <div class="form-group">
                <label>Descripción</label>
                <input type="text" id="edit-v-nombre" class="form-control" value="${item.nombre}">
            </div>
            <div class="form-group">
                <label>Monto ($)</label>
                <input type="number" id="edit-v-monto" class="form-control" value="${item.monto}">
            </div>
        `;
        const footerHtml = `<button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button><button class="btn btn-primary" id="btn-update-virtual">Actualizar</button>`;
        window.Modal.show('Editar Pendiente', formHtml, footerHtml);
        document.getElementById('btn-update-virtual').addEventListener('click', () => {
            item.nombre = document.getElementById('edit-v-nombre').value.trim();
            item.monto = parseFloat(document.getElementById('edit-v-monto').value);
            window.Modal.close();
            this.renderDashboard();
        });
    },

    eliminarVirtual(tempId) {
        const mes = this.periodoActual;
        const item = this.pendientesPorMes[mes].find(v => v.tempId === tempId);
        if (item) {
            this.borradosPorMes[mes].add(item.baseNombre);
            this.pendientesPorMes[mes] = this.pendientesPorMes[mes].filter(v => v.tempId !== tempId);
        }
        this.renderDashboard();
    },

    async confirmarPagoVirtual(tempId) {
        const mes = this.periodoActual;
        const item = this.pendientesPorMes[mes].find(v => v.tempId === tempId);
        if (!item) return;

        if (!confirm(`¿Confirmar pago de "${item.nombre}" por $${item.monto.toLocaleString()}?`)) return;

        const data = {
            categoria_id: item.categoria_id || item.categoria,
            nombre_gasto: item.nombre,
            periodo_mes: mes,
            monto: item.monto,
            fecha_pago: new Date().toISOString().split('T')[0],
            estado: 'Pago'
        };

        try {
            await GristData.addRecord('Gastos_Mensuales', data);
            
            // Refrescar data
            this.gastosPagados = await GristData.getTable('Gastos_Mensuales');
            this.sincronizarGastosVirtuales();
            this.renderDashboard();
            
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
