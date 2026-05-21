window.ViewPagos = {
    alumnosData: null,
    planesData: null,
    pagosData: null,
    periodoActual: '',
    filtroTipoPlanes: [],
    searchTerm: '',
    filtroEstado: 'Todos',

    async render() {
        const container = document.getElementById('pagos-container');

        if (!this.periodoActual) {
            const now = new Date();
            this.periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Usar caché del prefetch global para pintar de inmediato
        if (!this.alumnosData) {
            this.alumnosData = GristData.getCached('Alumnos');
            this.planesData  = GristData.getCached('Planes');
            this.pagosData   = GristData.getCached('Pagos');
        }

        if (this.alumnosData) {
            this.renderDashboard();
        } else {
            container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando pagos...</p>';
        }

        try {
            // Actualización en segundo plano
            const [alumnos, planes, pagos] = await Promise.all([
                GristData.getTable('Alumnos'),
                GristData.getTable('Planes'),
                GristData.getTable('Pagos')
            ]);

            this.alumnosData = alumnos;
            this.planesData = planes;
            this.pagosData = pagos;

            if (!alumnos || !planes) {
                if (!this.alumnosData) container.innerHTML = '<p style="color: var(--danger);">Error cargando datos base de Pagos.</p>';
                return;
            }

            this.renderDashboard();

        } catch (error) {
            console.error("Error en Vista Pagos:", error);
            if (!this.alumnosData) container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando pagos.</p>';
        }
    },

    aplicarFiltros() {
        this.periodoActual = document.getElementById('filtro-periodo').value;
        this.searchTerm = (document.getElementById('filtro-pagos-alumno')?.value || '').toLowerCase();
        this.filtroEstado = document.getElementById('filtro-pagos-estado')?.value || 'Todos';

        const checkboxes = document.querySelectorAll('.filtro-plan-chk');
        this.filtroTipoPlanes = [];
        checkboxes.forEach(chk => {
            if (chk.checked) this.filtroTipoPlanes.push(chk.value);
        });
        this.renderDashboard();
    },

    calcularVencimiento(fechaIngresoIso, periodoYyyyMm) {
        if (!fechaIngresoIso) return null;
        let dia = 1;
        if (typeof fechaIngresoIso === 'number') {
            dia = new Date(fechaIngresoIso * 1000).getUTCDate();
        } else if (typeof fechaIngresoIso === 'string') {
            const parts = fechaIngresoIso.split('-');
            if (parts.length >= 3) dia = parseInt(parts[2].substring(0, 2));
        }
        const [year, month] = periodoYyyyMm.split('-');
        const maxDaysInMonth = new Date(year, month, 0).getDate();
        if (dia > maxDaysInMonth) dia = maxDaysInMonth;
        return `${year}-${month}-${String(dia).padStart(2, '0')}`;
    },

    getDifferenceInDays(dateStr1, dateStr2) {
        const d1 = new Date(dateStr1 + 'T00:00:00');
        const d2 = new Date(dateStr2 + 'T00:00:00');
        return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    },

    renderDashboard() {
        const container = document.getElementById('pagos-container');
        if (!this.alumnosData) return;

        // Guardar foco y posición del cursor
        const activeElementId = document.activeElement ? document.activeElement.id : null;
        const selectionStart = document.activeElement ? document.activeElement.selectionStart : null;
        const selectionEnd = document.activeElement ? document.activeElement.selectionEnd : null;

        let totalActivos = 0;
        let totalACobrar = 0;
        let totalCobrado = 0;
        let totalPagosCount = 0;
        let totalImpagosCount = 0;

        // Usar fecha local (no UTC) para evitar desfasajes de zona horaria
        const _hoy = new Date();
        const hoyIso = `${_hoy.getFullYear()}-${String(_hoy.getMonth() + 1).padStart(2, '0')}-${String(_hoy.getDate()).padStart(2, '0')}`;
        const alumnosProcesados = [];

        const pagosPorAlumno = {};
        if (this.pagosData && this.pagosData.id) {
            for (let i = 0; i < this.pagosData.id.length; i++) {
                if (this.pagosData.mes_correspondiente[i] === this.periodoActual) {
                    const aId = this.pagosData.alumno_id[i];
                    pagosPorAlumno[aId] = (pagosPorAlumno[aId] || 0) + (parseFloat(this.pagosData.monto_pagado[i]) || 0);
                }
            }
        }

        const planesMap = {}; // planId -> { nombre, tipo, importe }
        if (this.planesData && this.planesData.id) {
            for (let p = 0; p < this.planesData.id.length; p++) {
                planesMap[this.planesData.id[p]] = {
                    nombre: this.planesData.nombre_plan[p],
                    tipo: this.planesData.tipo_plan ? (this.planesData.tipo_plan[p] || '') : '',
                    importe: parseFloat(this.planesData.importe[p]) || 0,
                    combo: this.planesData.Combo ? !!this.planesData.Combo[p] : false
                };
            }
        }

        if (this.alumnosData.id) {
            for (let i = 0; i < this.alumnosData.id.length; i++) {
                // Solo alumnos Activos
                if (this.alumnosData.estado[i] !== 'Activo') continue;

                let fechaIngreso = this.alumnosData.fecha_ingreso[i];
                let fechaIso = '';
                if (typeof fechaIngreso === 'number') fechaIso = new Date(fechaIngreso * 1000).toISOString().split('T')[0];
                else if (typeof fechaIngreso === 'string') fechaIso = fechaIngreso.split('T')[0];

                // Solo alumnos que ingresaron antes o durante el periodo
                if (fechaIso && fechaIso.substring(0, 7) > this.periodoActual) continue;

                const planId = this.alumnosData.plan_id[i];
                const planInfo = planesMap[planId] || { nombre: 'Sin Plan', tipo: '', importe: 0 };

                // Filtro por tipo de plan (agrupado)
                const planGroup = planInfo.combo ? 'Combo' : planInfo.nombre;
                if (this.filtroTipoPlanes.length > 0 && !this.filtroTipoPlanes.includes(planGroup)) continue;

                const pAlumno = pagosPorAlumno[this.alumnosData.id[i]] || 0;
                const displayName = this.alumnosData.Apellido_y_Nombre
                    ? (this.alumnosData.Apellido_y_Nombre[i] || '-')
                    : `${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}`;

                // Filtro por búsqueda
                if (this.searchTerm && !displayName.toLowerCase().includes(this.searchTerm)) continue;

                let estadoPago = '', colorEstado = '', bgEstado = '', esPago = false;
                let fechaVtoStr = this.calcularVencimiento(fechaIso, this.periodoActual);

                // Si hay cualquier pago registrado para este período → Pagado
                if (pAlumno > 0 && planInfo.importe > 0) {
                    estadoPago = 'Pagado'; colorEstado = 'var(--success)'; bgEstado = 'rgba(46, 204, 113, 0.1)';
                    esPago = true;
                } else if (planInfo.importe === 0) {
                    estadoPago = 'S/ Cargo'; colorEstado = 'var(--text-muted)'; bgEstado = 'rgba(255, 255, 255, 0.05)';
                    esPago = true;
                } else {
                    if (!fechaVtoStr) {
                        estadoPago = 'Sin Vto.'; colorEstado = 'var(--text-muted)'; bgEstado = 'rgba(255, 255, 255, 0.05)';
                    } else {
                        const diff = this.getDifferenceInDays(hoyIso, fechaVtoStr);
                        if (diff < 0) { estadoPago = 'Vencido'; colorEstado = 'var(--danger)'; bgEstado = 'rgba(231, 76, 60, 0.1)'; }
                        else if (diff <= 5) { estadoPago = 'Próx. a Vencer'; colorEstado = 'var(--warning)'; bgEstado = 'rgba(241, 196, 15, 0.1)'; }
                        else { estadoPago = 'Pendiente'; colorEstado = '#aaa'; bgEstado = 'rgba(255, 255, 255, 0.05)'; }
                    }
                }

                // Filtro por estado
                if (this.filtroEstado !== 'Todos') {
                    if (this.filtroEstado === 'Pagado' && !esPago) continue;
                    if (this.filtroEstado === 'Impago' && esPago) continue;
                    if (this.filtroEstado === 'Vencido' && estadoPago !== 'Vencido') continue;
                }

                // Acumular KPIs
                totalActivos++;
                totalACobrar += planInfo.importe;
                totalCobrado += pAlumno;
                if (esPago) totalPagosCount++;
                else totalImpagosCount++;

                alumnosProcesados.push({
                    displayName,
                    planNombre: planInfo.nombre,
                    vencimiento: fechaVtoStr,
                    cuota: planInfo.importe,
                    pagado: pAlumno,
                    estadoPago,
                    colorEstado,
                    bgEstado
                });
            }
        }

        // Ordenar alfabéticamente por nombre
        alumnosProcesados.sort((a, b) => a.displayName.localeCompare(b.displayName));

        const filasHtml = alumnosProcesados.map(a => `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px; font-weight: 500;">${a.displayName}</td>
                <td style="padding: 12px;">${a.planNombre}</td>
                <td style="padding: 12px; font-variant-numeric: tabular-nums;">${a.vencimiento ? a.vencimiento.split('-').reverse().join('/') : '-'}</td>
                <td style="padding: 12px; font-weight:600;">$${a.cuota}</td>
                <td style="padding: 12px; color: ${a.pagado >= a.cuota ? 'var(--success)' : 'inherit'}; font-weight:600;">$${a.pagado}</td>
                <td style="padding: 12px;">
                    <span style="background: ${a.bgEstado}; color: ${a.colorEstado}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid ${a.colorEstado}40;">
                        ${a.estadoPago}
                    </span>
                </td>
            </tr>
        `).join('');

        // Checkboxes de tipos (agrupados)
        const groupSet = new Set();
        Object.values(planesMap).forEach(p => {
            if (p.combo) groupSet.add('Combo');
            else if (p.nombre) groupSet.add(p.nombre);
        });
        const groupsArray = Array.from(groupSet);
        groupsArray.sort();
        let planCheckboxesHtml = '';
        groupsArray.forEach(group => {
            const checked = this.filtroTipoPlanes.includes(group) ? 'checked' : '';
            planCheckboxesHtml += `
                <label style="display:flex; align-items:center; gap:5px; font-size:13px; color:var(--text-muted); cursor:pointer;">
                    <input type="checkbox" class="filtro-plan-chk" value="${group}" ${checked} onchange="window.ViewPagos.aplicarFiltros()">
                    ${group}
                </label>
            `;
        });

        container.innerHTML = `
            <div class="kpi-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div class="kpi-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); display:flex; align-items:center; gap: 12px;">
                    <i class="ph ph-users" style="font-size: 28px; color: var(--primary);"></i>
                    <div>
                        <div style="font-size: 11px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">Activos</div>
                        <div style="font-size: 20px; font-weight: 700;">${totalActivos}</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); display:flex; align-items:center; gap: 12px;">
                    <i class="ph ph-check-circle" style="font-size: 28px; color: var(--success);"></i>
                    <div>
                        <div style="font-size: 11px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">Pagos</div>
                        <div style="font-size: 20px; font-weight: 700;">${totalPagosCount}</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); display:flex; align-items:center; gap: 12px;">
                    <i class="ph ph-warning-circle" style="font-size: 28px; color: var(--danger);"></i>
                    <div>
                        <div style="font-size: 11px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">Impagos</div>
                        <div style="font-size: 20px; font-weight: 700;">${totalImpagosCount}</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); display:flex; align-items:center; gap: 12px;">
                    <i class="ph ph-trend-up" style="font-size: 28px; color: var(--text-muted);"></i>
                    <div>
                        <div style="font-size: 11px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">A Cobrar</div>
                        <div style="font-size: 20px; font-weight: 700;">$${totalACobrar}</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); border-left: 4px solid var(--success); display:flex; align-items:center; gap: 12px;">
                    <i class="ph ph-money" style="font-size: 28px; color: var(--success);"></i>
                    <div>
                        <div style="font-size: 11px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">Cobrado</div>
                        <div style="font-size: 20px; font-weight: 700;">$${totalCobrado}</div>
                    </div>
                </div>
            </div>

            <div class="filters-panel" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 20px;">
                <div style="display:flex; gap: 20px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="min-width: 150px;">
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Período</label>
                        <input type="month" id="filtro-periodo" class="form-control" value="${this.periodoActual}" onchange="window.ViewPagos.aplicarFiltros()" style="background: rgba(0,0,0,0.2); border:1px solid var(--border); color:white;">
                    </div>
                    
                    <div style="min-width: 200px; position:relative;">
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Buscar Alumno</label>
                        <i class="ph ph-magnifying-glass" style="position:absolute; left:10px; bottom:12px; color:var(--text-muted);"></i>
                        <input type="text" id="filtro-pagos-alumno" class="form-control" placeholder="Nombre o apellido..." value="${this.searchTerm}" oninput="window.ViewPagos.aplicarFiltros()" style="background: rgba(0,0,0,0.2); border:1px solid var(--border); color:white; padding-left: 30px;">
                    </div>

                    <div style="min-width: 150px;">
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Estado Pago</label>
                        <select id="filtro-pagos-estado" class="form-control" onchange="window.ViewPagos.aplicarFiltros()" style="background: rgba(0,0,0,0.2); border:1px solid var(--border); color:white; color-scheme: dark;">
                            <option value="Todos" ${this.filtroEstado === 'Todos' ? 'selected' : ''}>Todos</option>
                            <option value="Pagado" ${this.filtroEstado === 'Pagado' ? 'selected' : ''}>Pagados</option>
                            <option value="Impago" ${this.filtroEstado === 'Impago' ? 'selected' : ''}>Impagos</option>
                            <option value="Vencido" ${this.filtroEstado === 'Vencido' ? 'selected' : ''}>Vencidos</option>
                        </select>
                    </div>

                    <div style="flex: 1; min-width: 250px;">
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Filtrar por Plan</label>
                        <div style="display:flex; gap:15px; flex-wrap:wrap;">
                            ${planCheckboxesHtml || '<span style="font-size:13px; color:var(--text-muted);">No hay planes</span>'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                            <th style="padding: 12px;">Alumno</th>
                            <th style="padding: 12px;">Plan</th>
                            <th style="padding: 12px;">Vencimiento</th>
                            <th style="padding: 12px;">Cuota</th>
                            <th style="padding: 12px;">Pagado</th>
                            <th style="padding: 12px;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml || '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">No se encontraron resultados con los filtros aplicados.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        // Restaurar foco y selección
        if (activeElementId) {
            const el = document.getElementById(activeElementId);
            if (el) {
                el.focus();
                if (selectionStart !== null && selectionEnd !== null && el.setSelectionRange) {
                    el.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }
    }
};
