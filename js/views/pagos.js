window.ViewPagos = {
    alumnosData: null,
    planesData: null,
    pagosData: null,
    periodoActual: '',
    filtroPlanes: [],

    async render() {
        const container = document.getElementById('pagos-container');
        
        if (!this.periodoActual) {
            const now = new Date();
            this.periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Carga inmediata con caché
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
        const checkboxes = document.querySelectorAll('.filtro-plan-chk');
        this.filtroPlanes = [];
        checkboxes.forEach(chk => {
            if (chk.checked) this.filtroPlanes.push(parseInt(chk.value));
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

        let totalActivos = 0;
        let totalACobrar = 0;
        let totalCobrado = 0;
        const filas = [];
        const hoyIso = new Date().toISOString().split('T')[0];

        const pagosPorAlumno = {};
        if (this.pagosData && this.pagosData.id) {
            for (let i = 0; i < this.pagosData.id.length; i++) {
                if (this.pagosData.mes_correspondiente[i] === this.periodoActual) {
                    const aId = this.pagosData.alumno_id[i];
                    pagosPorAlumno[aId] = (pagosPorAlumno[aId] || 0) + (parseFloat(this.pagosData.monto_pagado[i]) || 0);
                }
            }
        }

        const planesMap = {};
        if (this.planesData && this.planesData.id) {
            for (let p = 0; p < this.planesData.id.length; p++) {
                planesMap[this.planesData.id[p]] = {
                    nombre: this.planesData.nombre_plan[p],
                    importe: parseFloat(this.planesData.importe[p]) || 0
                };
            }
        }

        if (this.alumnosData.id) {
            for (let i = 0; i < this.alumnosData.id.length; i++) {
                if (this.alumnosData.estado[i] === 'Activo') {
                    let fechaIngreso = this.alumnosData.fecha_ingreso[i];
                    let fechaIso = '';
                    if (typeof fechaIngreso === 'number') fechaIso = new Date(fechaIngreso * 1000).toISOString().split('T')[0];
                    else if (typeof fechaIngreso === 'string') fechaIso = fechaIngreso.split('T')[0];

                    if (fechaIso && fechaIso.substring(0, 7) > this.periodoActual) continue;

                    const planId = this.alumnosData.plan_id[i];
                    if (this.filtroPlanes.length > 0 && !this.filtroPlanes.includes(planId)) continue;

                    const planInfo = planesMap[planId] || { nombre: 'Sin Plan', importe: 0 };
                    totalActivos++;
                    totalACobrar += planInfo.importe;

                    const pAlumno = pagosPorAlumno[this.alumnosData.id[i]] || 0;
                    totalCobrado += pAlumno;

                    let estadoPago = '', colorEstado = '', bgEstado = '';
                    let fechaVtoStr = this.calcularVencimiento(fechaIso, this.periodoActual);

                    if (pAlumno >= planInfo.importe && planInfo.importe > 0) {
                        estadoPago = 'Pagado'; colorEstado = 'var(--success)'; bgEstado = 'rgba(46, 204, 113, 0.1)';
                    } else if (planInfo.importe === 0) {
                        estadoPago = 'S/ Cargo'; colorEstado = 'var(--text-muted)'; bgEstado = 'rgba(255, 255, 255, 0.05)';
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

                    filas.push(`
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 12px; font-weight: 500;">${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}</td>
                            <td style="padding: 12px;">${planInfo.nombre}</td>
                            <td style="padding: 12px; font-variant-numeric: tabular-nums;">${fechaVtoStr ? fechaVtoStr.split('-').reverse().join('/') : '-'}</td>
                            <td style="padding: 12px; font-weight:600;">$${planInfo.importe}</td>
                            <td style="padding: 12px; color: ${pAlumno >= planInfo.importe ? 'var(--success)' : 'inherit'}; font-weight:600;">$${pAlumno}</td>
                            <td style="padding: 12px;">
                                <span style="background: ${bgEstado}; color: ${colorEstado}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid ${colorEstado}40;">
                                    ${estadoPago}
                                </span>
                            </td>
                        </tr>
                    `);
                }
            }
        }

        let planCheckboxesHtml = '';
        Object.keys(planesMap).forEach(pId => {
            const checked = this.filtroPlanes.includes(parseInt(pId)) ? 'checked' : '';
            planCheckboxesHtml += `
                <label style="display:flex; align-items:center; gap:5px; font-size:13px; color:var(--text-muted); cursor:pointer;">
                    <input type="checkbox" class="filtro-plan-chk" value="${pId}" ${checked} onchange="window.ViewPagos.aplicarFiltros()">
                    ${planesMap[pId].nombre}
                </label>
            `;
        });

        container.innerHTML = `
            <div class="kpi-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div class="kpi-card" style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); border: 1px solid var(--border); display:flex; align-items:center; gap: 15px;">
                    <i class="ph ph-users" style="font-size: 32px; color: var(--primary);"></i>
                    <div>
                        <div style="font-size: 13px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">Alumnos Activos</div>
                        <div style="font-size: 24px; font-weight: 700;">${totalActivos}</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); border: 1px solid var(--border); display:flex; align-items:center; gap: 15px;">
                    <i class="ph ph-receipt" style="font-size: 32px; color: var(--text-muted);"></i>
                    <div>
                        <div style="font-size: 13px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">Total a Cobrar</div>
                        <div style="font-size: 24px; font-weight: 700;">$${totalACobrar}</div>
                    </div>
                </div>
                <div class="kpi-card" style="background: var(--bg-card); padding: 20px; border-radius: var(--radius); border: 1px solid var(--border); border-left: 4px solid var(--success); display:flex; align-items:center; gap: 15px;">
                    <i class="ph ph-currency-dollar" style="font-size: 32px; color: var(--success);"></i>
                    <div>
                        <div style="font-size: 13px; color: var(--text-muted); font-weight:600; text-transform:uppercase;">Total Cobrado</div>
                        <div style="font-size: 24px; font-weight: 700;">$${totalCobrado}</div>
                    </div>
                </div>
            </div>

            <div class="filters-panel" style="background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 20px;">
                <div style="display:flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
                    <div style="min-width: 200px;">
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">Período</label>
                        <input type="month" id="filtro-periodo" class="form-control" value="${this.periodoActual}" onchange="window.ViewPagos.aplicarFiltros()" style="background: rgba(0,0,0,0.2); border:1px solid var(--border); color:white;">
                    </div>
                    <div style="flex: 1;">
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
                        ${filas.length > 0 ? filas.join('') : '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay alumnos activos para este período.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }
};
