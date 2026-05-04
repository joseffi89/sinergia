window.ViewGastos = {
    gastosPagados: null,
    categoriasData: null,
    // Gastos temporales por mes: { '2026-05': [ ... ] }
    gastosTemporalesPorMes: {}, 
    // Gastos fijos que el usuario definió manualmente en esta sesión (para que propaguen antes de ser pagados)
    fijosManualesSesion: [], 
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
            this.renderDashboard();

        } catch (error) {
            console.error("Error en Vista Gastos:", error);
            if (!this.gastosPagados) container.innerHTML = '<p style="color: var(--danger);">Error de conexión.</p>';
        }
    },

    renderDashboard() {
        const container = document.getElementById('gastos-container');
        if (!this.gastosPagados) return;

        const mes = this.periodoActual;
        let totalPagado = 0;
        let totalPendiente = 0;
        const listaFinal = [];

        // 1. Mapear categorías para búsqueda rápida
        const catMap = {}; // id -> nombre
        let idFijo = null;
        if (this.categoriasData && this.categoriasData.id) {
            this.categoriasData.id.forEach((cid, i) => {
                const name = this.categoriasData.nombre_categoria[i];
                catMap[cid] = name;
                if (name === 'Fijo') idFijo = cid;
            });
        }

        // 2. Extraer todos los Gastos Fijos históricos de Grist (para propagarlos)
        const fijosDesdeGrist = new Map();
        if (this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                const cId = this.gastosPagados.categoria_id[i];
                if (cId === idFijo || catMap[cId] === 'Fijo') {
                    const nombre = (this.gastosPagados.nombre_gasto[i] || '').trim();
                    const monto = parseFloat(this.gastosPagados.monto[i]) || 0;
                    if (nombre) fijosDesdeGrist.set(nombre.toLowerCase(), { nombre, monto, catId: cId || idFijo });
                }
            }
        }

        // 3. Identificar Pagos Reales del Mes Actual
        const pagadosEsteMes = new Set();
        if (this.gastosPagados.id) {
            for (let i = 0; i < this.gastosPagados.id.length; i++) {
                // Normalización de periodo para evitar fallos de formato (Ej: 2026-05 vs 2026-5)
                const pGrist = this.gastosPagados.periodo_mes[i];
                const pActual = this.periodoActual;
                
                // Comprobamos si el periodo coincide (siendo flexibles con el formato)
                if (pGrist === pActual || (pGrist && pGrist.replace(/-0/g, '-') === pActual.replace(/-0/g, '-'))) {
                    const monto = parseFloat(this.gastosPagados.monto[i]) || 0;
                    totalPagado += monto;
                    const nombre = (this.gastosPagados.nombre_gasto[i] || '').trim();
                    pagadosEsteMes.add(nombre.toLowerCase());

                    listaFinal.push({
                        id: this.gastosPagados.id[i],
                        nombre: nombre,
                        monto: monto,
                        categoria: catMap[this.gastosPagados.categoria_id[i]] || 'General',
                        fecha_pago: this.gastosPagados.fecha_pago[i],
                        estado: 'Pagado'
                    });
                }
            }
        }

        // 4. Construir lista de Pendientes (Virtuales)
        const pendientesMes = [];

        // A. Fijos históricos (de Grist) que no se han pagado este mes
        fijosDesdeGrist.forEach((data, nombreKey) => {
            if (!pagadosEsteMes.has(nombreKey)) {
                pendientesMes.push({
                    tempId: 'fix-db-' + nombreKey,
                    nombre: data.nombre,
                    monto: data.monto,
                    categoria: 'Fijo',
                    categoria_id: data.catId
                });
            }
        });

        // B. Fijos manuales de esta sesión (que aún no tienen historial en Grist)
        this.fijosManualesSesion.forEach(f => {
            const nombreKey = f.nombre.toLowerCase();
            if (!pagadosEsteMes.has(nombreKey) && !fijosDesdeGrist.has(nombreKey)) {
                pendientesMes.push({
                    tempId: 'fix-man-' + nombreKey,
                    nombre: f.nombre,
                    monto: f.monto,
                    categoria: 'Fijo',
                    categoria_id: f.categoria_id
                });
            }
        });

        // C. Alquiler por defecto (si no existe en ninguna lista anterior)
        if (!pagadosEsteMes.has('alquiler') && !fijosDesdeGrist.has('alquiler') && !this.fijosManualesSesion.some(f => f.nombre.toLowerCase() === 'alquiler')) {
            pendientesMes.push({
                tempId: 'fix-def-alquiler',
                nombre: 'Alquiler',
                monto: 1000000,
                categoria: 'Fijo',
                categoria_id: idFijo || 1
            });
        }

        // D. Temporales de este mes específico
        const temporales = this.gastosTemporalesPorMes[this.periodoActual] || [];
        temporales.forEach(t => {
            if (!pagadosEsteMes.has(t.nombre.toLowerCase())) {
                pendientesMes.push(t);
            }
        });

        // Integrar pendientes a la lista final y sumar KPIs
        pendientesMes.forEach(p => {
            totalPendiente += p.monto;
            listaFinal.push({
                ...p,
                fecha_pago: null,
                estado: 'Impago'
            });
        });

        // Ordenar: Impagos arriba
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
                        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.ViewGastos.confirmarPagoVirtual('${g.tempId}', '${g.nombre}', ${g.monto}, ${g.categoria_id})"><i class="ph ph-hand-coins"></i> Pagar</button>
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
                    <option value="Fijo">Fijo (Se repite todos los meses)</option>
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

            let catId = 2; // Temporal por defecto
            if (this.categoriasData && this.categoriasData.id) {
                const idx = this.categoriasData.nombre_categoria.indexOf(categoria);
                if (idx !== -1) catId = this.categoriasData.id[idx];
            }

            const item = {
                tempId: Date.now().toString(),
                nombre,
                monto,
                categoria,
                categoria_id: catId
            };

            if (categoria === 'Fijo') {
                this.fijosManualesSesion.push(item);
            } else {
                if (!this.gastosTemporalesPorMes[this.periodoActual]) this.gastosTemporalesPorMes[this.periodoActual] = [];
                this.gastosTemporalesPorMes[this.periodoActual].push(item);
            }

            window.Modal.close();
            this.renderDashboard();
        });
    },

    editarVirtual(tempId) {
        // Buscar en todas las posibles fuentes de virtuales
        let item = null;
        let source = null;

        // Buscar en temporales del mes actual
        const temporales = this.gastosTemporalesPorMes[this.periodoActual] || [];
        item = temporales.find(v => v.tempId === tempId);
        if (item) source = temporales;

        // Buscar en fijos manuales
        if (!item) {
            item = this.fijosManualesSesion.find(v => v.tempId === tempId);
            if (item) source = this.fijosManualesSesion;
        }

        // Buscar en fijos heredados de DB (creamos una copia local para editar si no existe)
        if (!item && tempId.startsWith('fix-db-')) {
            // Para editar un heredado de DB sin que haya registro aún, lo convertimos en un fijo manual de sesión
            const nombreKey = tempId.replace('fix-db-', '');
            // Buscamos los datos originales
            this.renderDashboard(); // Aseguramos que se ejecute la lógica de render para tener datos frescos
            // En lugar de buscar, simplemente creamos un modal con los datos que se ven
            // Pero para simplificar, usaremos un enfoque directo:
            const row = document.querySelector(`button[onclick*="${tempId}"]`).closest('tr');
            const nombre = row.querySelector('span[style*="font-weight: 500"]').innerText;
            const monto = parseFloat(row.querySelectorAll('td')[1].innerText.replace('$', '').replace(/,/g, ''));
            
            this.fijosManualesSesion.push({
                tempId: 'fix-man-' + Date.now(),
                nombre: nombre,
                monto: monto,
                categoria: 'Fijo',
                categoria_id: 1 // Asumido
            });
            this.renderDashboard();
            alert("Gasto fijo habilitado para edición. Vuelva a presionar editar.");
            return;
        }

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

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-update-virtual">Actualizar</button>
        `;

        window.Modal.show('Editar Pendiente', formHtml, footerHtml);

        document.getElementById('btn-update-virtual').addEventListener('click', () => {
            item.nombre = document.getElementById('edit-v-nombre').value.trim();
            item.monto = parseFloat(document.getElementById('edit-v-monto').value);
            window.Modal.close();
            this.renderDashboard();
        });
    },

    eliminarVirtual(tempId) {
        if (this.gastosTemporalesPorMes[this.periodoActual]) {
            this.gastosTemporalesPorMes[this.periodoActual] = this.gastosTemporalesPorMes[this.periodoActual].filter(v => v.tempId !== tempId);
        }
        this.fijosManualesSesion = this.fijosManualesSesion.filter(v => v.tempId !== tempId);
        
        // Si es un fix-db (heredado), no podemos "eliminarlo" de la DB sin pagar, 
        // pero podemos ignorarlo en la sesión si quisiéramos. Por ahora el usuario no pidió ocultar fijos heredados.
        this.renderDashboard();
    },

    async confirmarPagoVirtual(tempId, nombre, monto, catId) {
        if (!confirm(`¿Confirmar pago de "${nombre}" por $${monto.toLocaleString()}?`)) return;

        const data = {
            categoria_id: catId,
            nombre_gasto: nombre,
            periodo_mes: this.periodoActual,
            monto: monto,
            fecha_pago: new Date().toISOString().split('T')[0]
        };

        try {
            await GristData.addRecord('Gastos_Mensuales', data);
            
            // Si era un temporal manual, quitarlo
            if (this.gastosTemporalesPorMes[this.periodoActual]) {
                this.gastosTemporalesPorMes[this.periodoActual] = this.gastosTemporalesPorMes[this.periodoActual].filter(v => v.tempId !== tempId);
            }
            // Si era un fijo manual de sesión, ya no hace falta que sea manual porque ahora tiene historial en Grist
            this.fijosManualesSesion = this.fijosManualesSesion.filter(v => v.tempId !== tempId);

            this.gastosPagados = await GristData.getTable('Gastos_Mensuales');
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
            this.renderDashboard();
        } catch (e) {
            alert('Error al eliminar de Grist.');
        }
    }
};
