window.ViewTurnos = {
    currentTab: 'tab-calendario',
    actividadesData: null,
    horariosData: null,
    reservasData: null,
    alumnosData: null,
    filtroActividad: '',
    filtroTurno: '',
    filtroAlumnoTurno: '',
    filtroHora: '',
    filtroUbicacion: '',

    async render() {
        // Usar caché del prefetch global para pintar de inmediato
        if (!this.actividadesData) {
            this.actividadesData = GristData.getCached('Actividades');
            this.horariosData    = GristData.getCached('Horarios_Base');
            this.reservasData    = GristData.getCached('Turnos_Alumnos');
            this.alumnosData     = GristData.getCached('Alumnos');
            this.planesData      = GristData.getCached('Planes');
            this.pagosData       = GristData.getCached('Pagos');
        }

        // Pintar inmediatamente con lo que haya (caché o vacío)
        this.renderTabContent();

        try {
            // Re-fetch en paralelo en segundo plano para datos frescos
            const [actividades, horarios, reservas, alumnos, planes, pagos] = await Promise.all([
                GristData.getTable('Actividades').catch(() => ({ id: [] })),
                GristData.getTable('Horarios_Base').catch(() => ({ id: [] })),
                GristData.getTable('Turnos_Alumnos').catch(() => ({ id: [] })),
                GristData.getTable('Alumnos').catch(() => ({ id: [] })),
                GristData.getTable('Planes').catch(() => ({ id: [] })),
                GristData.getTable('Pagos').catch(() => ({ id: [] }))
            ]);

            this.actividadesData = actividades;
            this.horariosData = horarios;
            this.reservasData = reservas;
            this.alumnosData = alumnos;
            this.planesData = planes;
            this.pagosData = pagos;

            if (!this.actividadesData || !this.actividadesData.id) {
                document.getElementById('turnos-container').innerHTML =
                    '<p style="color: var(--danger);">Error al conectar con Grist o tablas no encontradas.</p>';
                return;
            }

            this.renderTabContent();
        } catch (e) {
            console.error(e);
            if (!this.actividadesData) {
                document.getElementById('turnos-container').innerHTML =
                    '<p style="color: var(--danger);">Ocurrió un error renderizando turnos.</p>';
            }
        }
    },

    switchTab(tabId) {
        this.currentTab = tabId;
        // Update active class on buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
                btn.style.color = 'var(--primary)';
            } else {
                btn.classList.remove('active');
                btn.style.color = 'var(--text-muted)';
            }
        });
        this.renderTabContent();
    },

    renderTabContent() {
        const container = document.getElementById('turnos-container');
        if (this.currentTab === 'tab-calendario') {
            if (!this.actividadesData) {
                // Sin datos aún: mostrar cabecera estática + spinner solo en la grilla
                container.innerHTML = this.getCalendarioHtml();
                return;
            }
            const existingHeader = document.querySelector('.calendar-header');
            if (existingHeader) {
                const gridContainer = document.querySelector('.calendar-grid');
                if (gridContainer) {
                    gridContainer.outerHTML = this.getCalendarioGridHtml();
                }
            } else {
                container.innerHTML = this.getCalendarioHtml();
            }
        } else if (this.currentTab === 'tab-actividades') {
            container.innerHTML = this.getActividadesHtml();
        } else if (this.currentTab === 'tab-pagos') {
            container.innerHTML = this.getPagosHtml();
            this.setupPagosEvents();
        }
    },

    getCalendarioGridHtml() {
        const actividades = this.actividadesData;
        if (!actividades || !actividades.id) {
            return `<div style="text-align:center; padding:20px;"><i class="ph ph-spinner ph-spin"></i></div>`;
        }

        const validClasses = this.getFilteredClasses();
        
        const timesSet = new Set();
        validClasses.forEach(c => timesSet.add(c.horaInicio));
        const uniqueTimes = Array.from(timesSet).sort((a, b) => {
            const ta = parseInt(a.replace(':', ''));
            const tb = parseInt(b.replace(':', ''));
            return ta - tb;
        });

        const dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

        if (uniqueTimes.length === 0) {
            return `<div style="text-align:center; padding: 40px; color: var(--text-muted);">No hay clases que coincidan con los filtros.</div>`;
        }

        let html = `
            <div class="calendar-grid" style="display:grid; grid-template-columns: 60px repeat(6, minmax(140px, 1fr)); gap: 10px; overflow-x: auto;">
                <div style="padding: 10px;"></div>
                ${dias.map(dia => `
                    <h3 style="text-align:center; padding: 10px; background: var(--bg-card); border-radius: var(--radius); font-size: 14px; border-bottom: 2px solid var(--primary); margin: 0; position: sticky; top: 0; z-index: 10;">${dia}</h3>
                `).join('')}
        `;

        for (const time of uniqueTimes) {
            html += `
                <div style="text-align: right; padding-right: 10px; font-weight: 600; color: var(--text-muted); padding-top: 15px; border-top: 1px solid var(--border); font-size: 13px;">
                    ${time}
                </div>
            `;
            for (const dia of dias) {
                const classesInCell = validClasses.filter(c => c.dia === dia && c.horaInicio === time);
                let cellHtml = `<div style="border-top: 1px solid var(--border); padding-top: 10px; padding-bottom: 10px;">`;
                
                if (classesInCell.length > 0) {
                    for (const c of classesInCell) {
                        cellHtml += this.renderClaseCard(c, dia, actividades);
                    }
                }
                cellHtml += `</div>`;
                html += cellHtml;
            }
        }

        html += `</div>`;
        return html;
    },

    getCalendarioHtml() {
        const actividades = this.actividadesData;
        const horarios = this.horariosData;

        let optionsHtml = '<option value="">Todas las Actividades</option>';
        if (actividades && actividades.id) {
            // Sort activities alphabetically
            const sortedActividades = actividades.id.map((id, index) => ({
                id,
                nombre: actividades.nombre_actividad[index]
            })).sort((a, b) => a.nombre.localeCompare(b.nombre));

            sortedActividades.forEach(act => {
                const selected = (this.filtroActividad == act.id) ? 'selected' : '';
                optionsHtml += `<option value="${act.id}" ${selected}>${act.nombre}</option>`;
            });
        }

        // Filtro de Ubicaciones (valores únicos desde los horarios)
        let ubicacionesSet = new Set();
        if (horarios && horarios.id) {
            horarios.id.forEach((_, i) => {
                const ub = horarios.ubicacion ? horarios.ubicacion[i] : '';
                if (ub) ubicacionesSet.add(ub);
            });
        }
        let ubicacionesHtml = `<option value="" ${this.filtroUbicacion === '' ? 'selected' : ''}>Todas las Ubicaciones</option>`;
        [...ubicacionesSet].sort().forEach(ub => {
            ubicacionesHtml += `<option value="${ub}" ${this.filtroUbicacion === ub ? 'selected' : ''}>${ub}</option>`;
        });

        const turnosHtml = `
            <option value="" ${this.filtroTurno === '' ? 'selected' : ''}>Todos los turnos</option>
            <option value="mañana" ${this.filtroTurno === 'mañana' ? 'selected' : ''}>Mañana (hasta 12:00)</option>
            <option value="tarde" ${this.filtroTurno === 'tarde' ? 'selected' : ''}>Tarde (12:00 a 18:00)</option>
            <option value="noche" ${this.filtroTurno === 'noche' ? 'selected' : ''}>Noche (desde 18:00)</option>
        `;

        const searchInputHtml = `
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="position:relative; min-width:220px;">
                    <i class="ph ph-magnifying-glass" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                    <input type="text" id="filtro-alumno-turno" class="form-control" placeholder="Buscar alumno..." value="${this.filtroAlumnoTurno}" onkeyup="window.ViewTurnos.aplicarFiltros()" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding-left: 32px; width:100%;">
                </div>
                <div style="position:relative; width:120px;">
                    <i class="ph ph-clock" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                    <input type="time" id="filtro-hora-turno" class="form-control" value="${this.filtroHora || ''}" onchange="window.ViewTurnos.aplicarFiltros()" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding-left: 32px;">
                </div>
            </div>
        `;

        return `
            <div class="calendar-header" style="margin-bottom: 20px;">
                <div class="filters" style="display:flex; gap: 8px; align-items:center; flex-wrap:wrap;">
                    <select id="filtro-actividad" class="form-control" style="width:auto; background: var(--bg-card); color: white; border: 1px solid var(--border); padding: 8px; border-radius: var(--radius);" onchange="window.ViewTurnos.aplicarFiltros()">
                        ${optionsHtml}
                    </select>
                    <select id="filtro-turno" class="form-control" style="width:auto; background: var(--bg-card); color: white; border: 1px solid var(--border); padding: 8px; border-radius: var(--radius);" onchange="window.ViewTurnos.aplicarFiltros()">
                        ${turnosHtml}
                    </select>
                    <select id="filtro-ubicacion" class="form-control" style="width:auto; background: var(--bg-card); color: white; border: 1px solid var(--border); padding: 8px; border-radius: var(--radius);" onchange="window.ViewTurnos.aplicarFiltros()">
                        ${ubicacionesHtml}
                    </select>
                    ${searchInputHtml}
                </div>
            </div>
            ${this.getCalendarioGridHtml()}
        `;
    },

    aplicarFiltros() {
        this.filtroActividad = document.getElementById('filtro-actividad').value;
        this.filtroTurno = document.getElementById('filtro-turno').value;
        this.filtroAlumnoTurno = document.getElementById('filtro-alumno-turno').value;
        const horaInput = document.getElementById('filtro-hora-turno');
        this.filtroHora = horaInput ? horaInput.value : '';
        const ubicInput = document.getElementById('filtro-ubicacion');
        this.filtroUbicacion = ubicInput ? ubicInput.value : '';
        this.renderTabContent();
    },

    getAnotadosInfo(horarioBaseId) {
        if (!this.reservasData || !this.reservasData.id) return { regulares: 0, recuperaciones: 0, excepciones: 0 };
        let reg = 0, rec = 0, exc = 0;
        for (let i = 0; i < this.reservasData.id.length; i++) {
            if (this.reservasData.horario_base_id && this.reservasData.horario_base_id[i] === horarioBaseId) {
                const tipo = this.reservasData.tipo_reserva ? this.reservasData.tipo_reserva[i] : 'Regular';
                if (tipo === 'Recuperación') rec++;
                else if (tipo === 'Excepción') exc++;
                else reg++;
            }
        }
        return { regulares: reg, recuperaciones: rec, excepciones: exc };
    },

    getFilteredClasses() {
        const horarios = this.horariosData;
        if (!horarios || !horarios.id) return [];

        let validClasses = [];
        for (let i = 0; i < horarios.id.length; i++) {
            const c = {
                id: horarios.id[i],
                dia: horarios.dia_semana[i],
                actId: horarios.actividad_id[i],
                horaInicio: horarios.hora_inicio[i] || '',
                horaFin: horarios.hora_fin[i] || '',
                obs: horarios.observaciones ? horarios.observaciones[i] : '',
                ubicacion: horarios.ubicacion ? horarios.ubicacion[i] : ''
            };

            if (!c.horaInicio) continue;
            if (this.filtroActividad && c.actId.toString() !== this.filtroActividad) continue;

            if (this.filtroTurno) {
                const hora = parseInt(c.horaInicio.split(':')[0]);
                if (this.filtroTurno === 'mañana' && hora >= 12) continue;
                if (this.filtroTurno === 'tarde' && (hora < 12 || hora >= 18)) continue;
                if (this.filtroTurno === 'noche' && hora < 18) continue;
            }

            if (this.filtroHora && c.horaInicio !== this.filtroHora) continue;
            if (this.filtroUbicacion && (c.ubicacion || '') !== this.filtroUbicacion) continue;

            if (this.filtroAlumnoTurno) {
                let isEnrolled = false;
                const searchTerm = this.filtroAlumnoTurno.toLowerCase();
                if (this.reservasData && this.reservasData.id) {
                    for (let j = 0; j < this.reservasData.id.length; j++) {
                        if (this.reservasData.horario_base_id[j] === c.id) {
                            const alumnoId = this.reservasData.alumno_id[j];
                            if (this.alumnosData && this.alumnosData.id) {
                                const idx = this.alumnosData.id.indexOf(alumnoId);
                                if (idx !== -1) {
                                    const fullName = (this.alumnosData.Apellido_y_Nombre
                                        ? this.alumnosData.Apellido_y_Nombre[idx]
                                        : `${this.alumnosData.apellido[idx]} ${this.alumnosData.nombre[idx]}`
                                    ) || '';
                                    if (fullName.toLowerCase().includes(searchTerm)) {
                                        isEnrolled = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (!isEnrolled) continue;
            }

            validClasses.push(c);
        }
        return validClasses;
    },

    renderClaseCard(c, dia, actividades) {
        let actName = "Desc.";
        let color = "var(--primary)";
        let cupoMax = 0;

        if (actividades && actividades.id) {
            const actIndex = actividades.id.indexOf(c.actId);
            if (actIndex !== -1) {
                actName = actividades.nombre_actividad[actIndex];
                color = actividades.color_ui[actIndex] || color;
                cupoMax = actividades.cupo_maximo[actIndex] || 0;
            }
        }

        const info = this.getAnotadosInfo(c.id);
        const cupoBadge = cupoMax > 0 ? `${info.regulares}/${cupoMax}` : `${info.regulares}`;
        let extraBadges = '';
        if (info.recuperaciones > 0) extraBadges += `<span style="color:var(--primary); font-size:11px; margin-right:5px; font-weight:600;">${info.recuperaciones} R</span>`;
        if (info.excepciones > 0) extraBadges += `<span style="color:var(--danger); font-size:11px; margin-right:5px; font-weight:600;">${info.excepciones} E</span>`;

        const cupoLleno = cupoMax > 0 && info.regulares >= cupoMax;
        const cupoBadgeStyle = cupoLleno
            ? 'color:#e8924a; background:rgba(232,146,74,0.15); border:1px solid rgba(232,146,74,0.35);'
            : 'background: rgba(255,255,255,0.1);';

        return `
            <div class="turno-card" style="background: var(--bg-card); border: 1px solid var(--border); padding: 10px; border-radius: var(--radius); margin-bottom: 8px; border-left: 4px solid ${color}; cursor: pointer; transition: transform 0.2s;" onclick="window.ViewTurnos.openGestionClaseModal(${c.id}, ${c.actId}, '${actName}', '${dia} ${c.horaInicio}')">
                <div style="display:inline-flex; align-items:center; gap:5px; background:${color}22; border:1px solid ${color}55; border-radius:5px; padding:2px 6px; margin-bottom:4px;">
                    <i class="ph ph-clock" style="color:${color}; font-size:12px;"></i>
                    <span style="font-size:12px; font-weight:700; color:${color};">${c.horaInicio}</span>
                </div>
                <div style="font-weight: 500; font-size: 13px; margin-bottom: 2px;">${actName}</div>
                ${c.ubicacion ? `<div style="font-size: 10px; color: var(--text-muted); margin-bottom: 4px;"><i class="ph ph-map-pin"></i> ${c.ubicacion}</div>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size: 10px; padding: 2px 4px; border-radius: 4px; ${cupoBadgeStyle}">Cupos: ${cupoBadge}</span>
                    <div>${extraBadges} <i class="ph ph-users" style="color: var(--text-muted); font-size: 12px;"></i></div>
                </div>
            </div>
        `;
    },

    getActividadesHtml() {
        const actividades = this.actividadesData;
        let rows = '';
        if (actividades && actividades.id && actividades.id.length > 0) {
            // Sort activities alphabetically
            const sortedIndices = actividades.id.map((_, i) => i)
                .sort((a, b) => actividades.nombre_actividad[a].localeCompare(actividades.nombre_actividad[b]));

            for (const i of sortedIndices) {
                const nombre = actividades.nombre_actividad ? actividades.nombre_actividad[i] : 'Sin nombre';
                const cupo = actividades.cupo_maximo ? actividades.cupo_maximo[i] : 0;
                const color = actividades.color_ui ? actividades.color_ui[i] : '#000';

                rows += `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 12px; font-weight: 500;">
                            <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${color}; margin-right:8px; vertical-align:middle;"></span>
                            ${nombre}
                        </td>
                        <td style="padding: 12px;">${cupo}</td>
                        <td style="padding: 12px; text-align: right;">
                            <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 13px;" onclick="window.ViewTurnos.openHorariosModal(${i})"><i class="ph ph-clock"></i> Horarios</button>
                            <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 13px;" onclick="window.ViewTurnos.openActividadModal(${i})"><i class="ph ph-pencil-simple"></i> Editar</button>
                        </td>
                    </tr>
                `;
            }
        } else {
            rows = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay actividades</td></tr>';
        }

        return `
            <div style="display:flex; justify-content:space-between; margin-bottom: 20px;">
                <h3 style="font-size:18px;">Lista de Actividades</h3>
                <button class="btn btn-primary" onclick="window.ViewTurnos.openNewActividadModal()"><i class="ph ph-plus"></i> Nueva Actividad</button>
            </div>
            <div class="card" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 13px; text-transform: uppercase;">
                            <th style="padding: 12px;">Actividad</th>
                            <th style="padding: 12px;">Cupo Máximo</th>
                            <th style="padding: 12px; text-align:right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    },

    openNewActividadModal() {
        this.buildActividadModal('Nueva Actividad', null);
    },

    openActividadModal(index) {
        if (!this.actividadesData || !this.actividadesData.id) return;
        const id = this.actividadesData.id[index];
        const data = {
            nombre_actividad: this.actividadesData.nombre_actividad ? this.actividadesData.nombre_actividad[index] : '',
            cupo_maximo: this.actividadesData.cupo_maximo ? this.actividadesData.cupo_maximo[index] : 0,
            color_ui: this.actividadesData.color_ui ? this.actividadesData.color_ui[index] : '#f39c12'
        };
        this.buildActividadModal('Editar Actividad', id, data);
    },

    buildActividadModal(title, id, existingData = {}) {
        const nombre = existingData.nombre_actividad || '';
        const cupo = existingData.cupo_maximo || '';
        const color = existingData.color_ui || '#f39c12';

        const formHtml = `
            <div class="form-group">
                <label>Nombre de la Actividad</label>
                <input type="text" id="act-nombre" class="form-control" value="${nombre}">
            </div>
            <div class="form-group">
                <label>Cupo Máximo</label>
                <input type="number" id="act-cupo" class="form-control" value="${cupo}">
            </div>
            <div class="form-group">
                <label>Color (Hexadecimal, ej: #f39c12)</label>
                <input type="color" id="act-color" class="form-control" value="${color}" style="height:40px; padding:2px; border:1px solid var(--border); cursor:pointer;">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-act">Guardar</button>
        `;

        window.Modal.show(title, formHtml, footerHtml);

        document.getElementById('btn-save-act').addEventListener('click', async () => {
            const data = {
                nombre_actividad: document.getElementById('act-nombre').value,
                cupo_maximo: parseInt(document.getElementById('act-cupo').value) || 0,
                color_ui: document.getElementById('act-color').value
            };
            const btn = document.getElementById('btn-save-act');
            try {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
                btn.disabled = true;
                if (id) {
                    await GristData.updateRecord('Actividades', id, data);
                } else {
                    await GristData.addRecord('Actividades', data);
                }
                await new Promise(r => setTimeout(r, 600)); // Delay to allow Grist backend to sync
                window.Modal.close();
                this.render();
            } catch (e) {
                alert('Error al guardar la actividad');
                btn.innerHTML = 'Guardar';
                btn.disabled = false;
            }
        });
    },

    async openHorariosModal(index) {
        if (!this.actividadesData || !this.actividadesData.id) return;
        const actId = this.actividadesData.id[index];
        const actName = this.actividadesData.nombre_actividad[index];

        // Ensure we have fresh data for the modal
        this.horariosData = await GristData.getTable('Horarios_Base');

        // Find existing schedules
        let existingSchedules = [];
        if (this.horariosData && this.horariosData.id) {
            for (let i = 0; i < this.horariosData.id.length; i++) {
                if (this.horariosData.actividad_id[i] === actId) {
                    existingSchedules.push({
                        id: this.horariosData.id[i],
                        dia: this.horariosData.dia_semana[i],
                        inicio: this.horariosData.hora_inicio[i],
                        fin: this.horariosData.hora_fin[i],
                        obs: this.horariosData.observaciones ? this.horariosData.observaciones[i] : '',
                        ubicacion: this.horariosData.ubicacion ? this.horariosData.ubicacion[i] : ''
                    });
                }
            }
        }

        // Sort schedules by day
        const dayOrder = { 'Lunes': 1, 'Martes': 2, 'Miercoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sabado': 6, 'Domingo': 7 };
        existingSchedules.sort((a, b) => (dayOrder[a.dia] || 9) - (dayOrder[b.dia] || 9));

        let tableHtml = '';
        if (existingSchedules.length > 0) {
            tableHtml = `
                <table style="width:100%; border-collapse:collapse; margin-bottom: 20px; font-size:13px;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); text-align:left;">
                            <th style="padding:8px;">Día</th>
                            <th style="padding:8px;">Horario</th>
                            <th style="padding:8px; text-align:right;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${existingSchedules.map(sch => `
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:8px; font-weight:500;">${sch.dia}</td>
                                <td style="padding:8px;">
                                    ${sch.inicio} - ${sch.fin}
                                    <div style="font-size:11px; color:var(--text-muted);">${sch.ubicacion ? sch.ubicacion + ' - ' : ''}${sch.obs || ''}</div>
                                </td>
                                <td style="padding:8px; text-align:right; white-space: nowrap;">
                                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; color:var(--primary); margin-right:4px;" title="Editar Detalles" onclick="window.ViewTurnos.editHorarioDetalles(${sch.id}, '${sch.obs || ''}', '${sch.ubicacion || ''}', ${index})"><i class="ph ph-pencil-simple"></i></button>
                                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; color:var(--danger);" onclick="window.ViewTurnos.deleteHorario(${sch.id}, ${index})"><i class="ph ph-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            tableHtml = '<p style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">No hay horarios configurados para esta actividad.</p>';
        }

        const formHtml = `
            <div>
                <h4 style="margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:5px;">Horarios Existentes</h4>
                ${tableHtml}
                
                <h4 style="margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:5px;">Agregar Horarios</h4>
                <div class="form-group">
                    <label>Días de la Semana</label>
                    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:5px;">
                        ${['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'].map(dia => `
                            <label style="display:flex; align-items:center; gap:5px; background:var(--bg-dark); padding:5px 10px; border-radius:4px; border:1px solid var(--border); cursor:pointer; font-size:13px;">
                                <input type="checkbox" name="horario_dias" value="${dia}"> ${dia}
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="form-group" style="flex:1;">
                        <label>Hora Inicio</label>
                        <input type="time" id="bulk-inicio" class="form-control">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Hora Fin</label>
                        <input type="time" id="bulk-fin" class="form-control">
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="form-group" style="flex:1;">
                        <label>Ubicación</label>
                        <select id="bulk-ubicacion" class="form-control">
                            <option value="">Seleccionar Ubicación...</option>
                            <option value="Salón Grande">Salón Grande</option>
                            <option value="Salón Chico">Salón Chico</option>
                            <option value="Sinergia">Sinergia</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Observaciones</label>
                        <input type="text" id="bulk-obs" class="form-control" placeholder="Ej. Profe Juan">
                    </div>
                </div>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cerrar</button>
            <button class="btn btn-primary" id="btn-save-bulk">Agregar Horarios</button>
        `;

        window.Modal.show(`Horarios de ${actName}`, formHtml, footerHtml);

        document.getElementById('btn-save-bulk').addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('input[name="horario_dias"]:checked');
            const diasSeleccionados = Array.from(checkboxes).map(cb => cb.value);
            const hora_inicio = document.getElementById('bulk-inicio').value;
            const hora_fin = document.getElementById('bulk-fin').value;
            const observaciones = document.getElementById('bulk-obs').value;
            const ubicacion = document.getElementById('bulk-ubicacion').value;

            if (diasSeleccionados.length === 0) {
                alert("Debes seleccionar al menos un día.");
                return;
            }
            if (!hora_inicio || !hora_fin) {
                alert("Debes especificar la hora de inicio y fin.");
                return;
            }

            const dataArray = diasSeleccionados.map(dia => ({
                actividad_id: actId,
                dia_semana: dia,
                hora_inicio: hora_inicio,
                hora_fin: hora_fin,
                observaciones: observaciones,
                ubicacion: ubicacion
            }));

            const btn = document.getElementById('btn-save-bulk');
            try {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
                btn.disabled = true;
                await GristData.addRecords('Horarios_Base', dataArray);
                await new Promise(r => setTimeout(r, 600)); // Delay to allow Grist backend to sync
                await this.render(); // Refreshes the underlying view
                this.openHorariosModal(index); // Re-opens this modal to see updated data
            } catch (e) {
                alert('Error al agregar los horarios');
                btn.innerHTML = 'Agregar Horarios';
                btn.disabled = false;
            }
        });
    },

    async deleteHorario(horarioId, actIndex) {
        if (!confirm("¿Seguro que deseas eliminar este horario?")) return;
        try {
            await GristData.deleteRecord('Horarios_Base', horarioId);
            await new Promise(r => setTimeout(r, 600)); // Delay to allow Grist backend to sync
            await this.render(); // Refresh main view
            this.openHorariosModal(actIndex); // Refresh modal
        } catch (e) {
            alert("Error al eliminar horario.");
        }
    },

    editHorarioDetalles(horarioId, currentObs, currentUbic, actIndex) {
        const formHtml = `
            <div class="form-group">
                <label>Ubicación</label>
                <select id="edit-ubicacion" class="form-control">
                    <option value="">Seleccionar Ubicación...</option>
                    <option value="Salón Grande" ${currentUbic === 'Salón Grande' ? 'selected' : ''}>Salón Grande</option>
                    <option value="Salón Chico" ${currentUbic === 'Salón Chico' ? 'selected' : ''}>Salón Chico</option>
                    <option value="Sinergia" ${currentUbic === 'Sinergia' ? 'selected' : ''}>Sinergia</option>
                </select>
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <input type="text" id="edit-obs" class="form-control" value="${currentObs || ''}">
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-edit-horario">Guardar</button>
        `;

        window.Modal.show('Editar Detalles', formHtml, footerHtml);

        document.getElementById('btn-save-edit-horario').addEventListener('click', async () => {
            const nuevaObs = document.getElementById('edit-obs').value;
            const nuevaUbic = document.getElementById('edit-ubicacion').value;
            
            const btn = document.getElementById('btn-save-edit-horario');
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
            btn.disabled = true;

            try {
                await GristData.updateRecord('Horarios_Base', horarioId, { observaciones: nuevaObs, ubicacion: nuevaUbic });
                await new Promise(r => setTimeout(r, 600));
                await this.render();
                window.Modal.close();
                this.openHorariosModal(actIndex);
            } catch (e) {
                alert("Error al editar detalles");
                btn.innerHTML = 'Guardar';
                btn.disabled = false;
            }
        });
    },

    getAlumnoPagoStatus(alumnoId) {
        if (!this.pagosData || !this.planesData || !this.alumnosData) return 'var(--text-muted)';

        let aIdx = this.alumnosData.id.indexOf(alumnoId);
        if (aIdx === -1) return 'var(--text-muted)';

        const planId = this.alumnosData.plan_id[aIdx];
        let importePlan = 0;
        if (planId) {
            let pIdx = this.planesData.id.indexOf(planId);
            if (pIdx !== -1) importePlan = this.planesData.importe[pIdx] || 0;
        }

        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const hoyIso = now.toISOString().split('T')[0];

        let pagado = 0;
        if (this.pagosData && this.pagosData.id) {
            for (let i = 0; i < this.pagosData.id.length; i++) {
                if (this.pagosData.alumno_id[i] === alumnoId && this.pagosData.mes_correspondiente[i] === currentPeriod) {
                    pagado += parseFloat(this.pagosData.monto_pagado[i]) || 0;
                }
            }
        }

        if (pagado >= importePlan && importePlan > 0) return 'var(--success)';
        if (importePlan === 0) return 'var(--text-muted)';

        let fechaIngresoIso = this.alumnosData.fecha_ingreso[aIdx];
        let dia = 1;
        if (typeof fechaIngresoIso === 'number') {
            const dateObj = new Date(fechaIngresoIso * 1000);
            dia = dateObj.getUTCDate();
        } else if (typeof fechaIngresoIso === 'string') {
            const parts = fechaIngresoIso.split('-');
            if (parts.length >= 3) dia = parseInt(parts[2].substring(0, 2));
        }

        const [year, month] = currentPeriod.split('-');
        const maxDaysInMonth = new Date(year, month, 0).getDate();
        if (dia > maxDaysInMonth) dia = maxDaysInMonth;
        const vtoStr = `${year}-${month}-${String(dia).padStart(2, '0')}`;

        const d1 = new Date(hoyIso + 'T00:00:00');
        const d2 = new Date(vtoStr + 'T00:00:00');
        const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'var(--danger)'; // Vencido
        if (diffDays <= 5) return 'var(--warning)'; // Proximo a vencer
        return '#aaa'; // Pendiente
    },

    async openGestionClaseModal(horarioBaseId, actId, actName, horarioLabel) {
        // Enrolled students list
        let enrolledHtml = '';
        if (this.reservasData && this.reservasData.id) {
            let enrolled = [];
            for (let i = 0; i < this.reservasData.id.length; i++) {
                if (this.reservasData.horario_base_id[i] === horarioBaseId) {
                    const alumnoId = this.reservasData.alumno_id[i];
                    let alumnoName = 'Desconocido';
                    if (this.alumnosData && this.alumnosData.id) {
                        const aIdx = this.alumnosData.id.indexOf(alumnoId);
                        if (aIdx !== -1) {
                            alumnoName = this.alumnosData.Apellido_y_Nombre
                                ? (this.alumnosData.Apellido_y_Nombre[aIdx] || 'Desconocido')
                                : `${this.alumnosData.apellido[aIdx]}, ${this.alumnosData.nombre[aIdx]}`;
                        }
                    }

                    let tipoReserva = 'Regular';
                    if (this.reservasData.tipo_reserva && this.reservasData.tipo_reserva[i]) {
                        tipoReserva = this.reservasData.tipo_reserva[i];
                    }

                    let badge = '';
                    if (tipoReserva === 'Recuperación') {
                        badge = '<span style="background: var(--primary); color: white; font-size: 10px; padding: 2px 5px; border-radius: 4px; margin-left: 8px;">Recup.</span>';
                    } else if (tipoReserva === 'Excepción') {
                        badge = '<span style="background: var(--danger); color: white; font-size: 10px; padding: 2px 5px; border-radius: 4px; margin-left: 8px;">Excep.</span>';
                    }

                    const colorPago = this.getAlumnoPagoStatus(alumnoId);
                    const circleHtml = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${colorPago}; margin-right:8px; flex-shrink:0;" title="Estado de Pago Actual"></span>`;

                    enrolled.push({ id: this.reservasData.id[i], name: alumnoName, badge, circle: circleHtml });
                }
            }

            // Ordenar alfabeticamente
            enrolled.sort((a, b) => a.name.localeCompare(b.name));

            if (enrolled.length > 0) {
                enrolledHtml = `
                    <ul style="list-style:none; padding:0; margin:0 0 20px 0; font-size:13px; column-count: 2; column-gap: 15px;">
                        ${enrolled.map(en => `
                            <li style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border); break-inside: avoid;">
                                <span style="display:flex; align-items:center; min-width:0; margin-right:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${en.circle} <i class="ph ph-user" style="margin-right:4px;"></i> <span title="${en.name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${en.name}</span> ${en.badge}</span>
                                <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; color:var(--danger); flex-shrink:0;" onclick="window.ViewTurnos.bajarAlumno(${en.id}, ${horarioBaseId}, ${actId}, '${actName}', '${horarioLabel}')"><i class="ph ph-trash"></i></button>
                            </li>
                        `).join('')}
                    </ul>
                `;
            } else {
                enrolledHtml = '<p style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">No hay alumnos anotados.</p>';
            }
        }

        // Available students combo box — sorted alphabetically by Apellido_y_Nombre
        let habilitadosOpts = [];
        let todosOpts = [];
        if (this.alumnosData && this.alumnosData.id) {
            // Build list first, then sort
            this.alumnosData.id.forEach((aid, i) => {
                if (this.alumnosData.estado[i] !== 'Inactivo') {
                    const planId = this.alumnosData.plan_id ? this.alumnosData.plan_id[i] : null;
                    const displayName = this.alumnosData.Apellido_y_Nombre
                        ? (this.alumnosData.Apellido_y_Nombre[i] || `${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}`)
                        : `${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}`;

                    let allowed = false;
                    if (planId && this.planesData && this.planesData.id) {
                        const planIdx = this.planesData.id.indexOf(planId);
                        if (planIdx !== -1) {
                            const actPermitidas = this.planesData.actividades_permitidas ? this.planesData.actividades_permitidas[planIdx] : null;
                            if (Array.isArray(actPermitidas) && actPermitidas[0] === 'L') {
                                allowed = actPermitidas.includes(actId);
                            }
                        }
                    }

                    todosOpts.push({ aid, displayName });
                    if (allowed) habilitadosOpts.push({ aid, displayName });
                }
            });
        }

        // Sort alphabetically
        habilitadosOpts.sort((a, b) => a.displayName.localeCompare(b.displayName));
        todosOpts.sort((a, b) => a.displayName.localeCompare(b.displayName));

        let habilitadosHtml = '<option value="">Seleccionar Alumno...</option>' +
            habilitadosOpts.map(o => `<option value="${o.aid}">${o.displayName}</option>`).join('');
        let todosHtml = '<option value="">Seleccionar Alumno...</option>' +
            todosOpts.map(o => `<option value="${o.aid}">${o.displayName}</option>`).join('');

        // Datos del horario (ubicacion y observaciones)
        let horarioUbicacion = '';
        let horarioObs = '';
        if (this.horariosData && this.horariosData.id) {
            const hIdx = this.horariosData.id.indexOf(horarioBaseId);
            if (hIdx !== -1) {
                horarioUbicacion = this.horariosData.ubicacion ? (this.horariosData.ubicacion[hIdx] || '') : '';
                horarioObs = this.horariosData.observaciones ? (this.horariosData.observaciones[hIdx] || '') : '';
            }
        }
        const horarioInfoHtml = horarioObs ? `
            <div style="background: var(--bg-dark); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 18px; font-size: 13px; border-left: 3px solid var(--primary);">
                <div style="color: var(--text-muted);"><i class="ph ph-note"></i> <strong>Obs:</strong> ${horarioObs}</div>
            </div>
        ` : '';

        const formHtml = `
            ${horarioInfoHtml}
            <div style="margin-bottom: 20px; background: var(--bg-card); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border);">
                <div class="form-group" style="margin-bottom: 10px;">
                    <label style="font-weight:600;">Anotar Regular</label>
                    <div style="display:flex; gap:10px;">
                        <select id="modal-select-regular" class="form-control" style="flex:1;">
                            ${habilitadosHtml}
                        </select>
                        <button class="btn btn-primary" id="btn-anotar-regular">Anotar</button>
                    </div>
                </div>

                <div style="display:flex; gap:10px;">
                     <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" id="btn-show-recuperacion">+ Recuperación</button>
                     <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" id="btn-show-excepcion">+ Excepción</button>
                </div>

                <div class="form-group" id="special-enrollment-group" style="display:none; margin-top:15px; padding-top:15px; border-top:1px solid var(--border);">
                    <label id="special-enrollment-label" style="color:var(--primary); font-weight:600;">Anotar Especial</label>
                    <div style="display:flex; gap:10px;">
                        <select id="modal-select-special" class="form-control" style="flex:1;">
                            ${todosHtml}
                        </select>
                        <button class="btn btn-primary" id="btn-anotar-special">Anotar</button>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid var(--border);">Anotados</h4>
                ${enrolledHtml}
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cerrar</button>
        `;

        const tagUbicacion = horarioUbicacion ? `<span style="font-size: 13px; background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px; vertical-align: middle; margin-left: 10px; font-weight: normal; border: 1px solid rgba(255,255,255,0.15);"><i class="ph ph-map-pin"></i> ${horarioUbicacion}</span>` : '';
        window.Modal.show(`${actName} - ${horarioLabel}${tagUbicacion}`, formHtml, footerHtml);

        let tipoEspecialActual = 'Recuperación';

        document.getElementById('btn-show-recuperacion').addEventListener('click', () => {
            document.getElementById('special-enrollment-group').style.display = 'block';
            document.getElementById('special-enrollment-label').innerText = 'Anotar Recuperación';
            document.getElementById('special-enrollment-label').style.color = 'var(--primary)';
            tipoEspecialActual = 'Recuperación';
        });

        document.getElementById('btn-show-excepcion').addEventListener('click', () => {
            document.getElementById('special-enrollment-group').style.display = 'block';
            document.getElementById('special-enrollment-label').innerText = 'Anotar Excepción';
            document.getElementById('special-enrollment-label').style.color = 'var(--danger)';
            tipoEspecialActual = 'Excepción';
        });

        const handleAnotar = async (btnId, selectId, tipoReserva) => {
            const alumnoId = parseInt(document.getElementById(selectId).value);
            if (!alumnoId) {
                alert("Seleccione un alumno");
                return;
            }
            const btn = document.getElementById(btnId);
            try {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
                btn.disabled = true;

                await GristData.addRecord('Turnos_Alumnos', {
                    horario_base_id: horarioBaseId,
                    alumno_id: alumnoId,
                    tipo_reserva: tipoReserva
                });

                await new Promise(r => setTimeout(r, 600)); // Delay to allow Grist backend to sync
                await this.render();
                this.openGestionClaseModal(horarioBaseId, actId, actName, horarioLabel);
            } catch (error) {
                console.error("Error Grist:", error);
                alert('Error al anotar alumno: ' + (error.message || 'Verifica la consola'));
                btn.innerHTML = 'Anotar';
                btn.disabled = false;
            }
        };

        document.getElementById('btn-anotar-regular').addEventListener('click', () => handleAnotar('btn-anotar-regular', 'modal-select-regular', 'Regular'));
        document.getElementById('btn-anotar-special').addEventListener('click', () => handleAnotar('btn-anotar-special', 'modal-select-special', tipoEspecialActual));
    },

    async bajarAlumno(reservaId, horarioBaseId, actId, actName, horarioLabel) {
        if (!confirm("¿Dar de baja a este alumno de la clase?")) return;
        try {
            await GristData.deleteRecord('Turnos_Alumnos', reservaId);
            await new Promise(r => setTimeout(r, 600)); // Delay to allow Grist backend to sync
            await this.render();
            this.openGestionClaseModal(horarioBaseId, actId, actName, horarioLabel);
        } catch (e) {
            alert('Error al eliminar alumno');
        }
    },

    getPagosHtml() {
        // Build sorted list using Apellido_y_Nombre
        let alumnosActivos = [];
        if (this.alumnosData && this.alumnosData.id) {
            this.alumnosData.id.forEach((aid, i) => {
                if (this.alumnosData.estado[i] !== 'Inactivo') {
                    const planId = this.alumnosData.plan_id ? this.alumnosData.plan_id[i] : null;
                    let importePlan = 0;
                    if (planId && this.planesData && this.planesData.id) {
                        const planIdx = this.planesData.id.indexOf(planId);
                        if (planIdx !== -1) importePlan = this.planesData.importe[planIdx] || 0;
                    }
                    const displayName = this.alumnosData.Apellido_y_Nombre
                        ? (this.alumnosData.Apellido_y_Nombre[i] || `${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}`)
                        : `${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}`;
                    alumnosActivos.push({ aid, importePlan, displayName });
                }
            });
        }
        alumnosActivos.sort((a, b) => a.displayName.localeCompare(b.displayName));
        let options = '<option value="">Seleccione un alumno...</option>' +
            alumnosActivos.map(a => `<option value="${a.aid}" data-importe="${a.importePlan}">${a.displayName}</option>`).join('');

        const today = new Date().toISOString().split('T')[0];

        return `
            <div class="card" style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h3 style="margin-bottom: 20px; font-size: 18px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">Registrar Pago</h3>
                
                <div class="form-group">
                    <label>Alumno</label>
                    <select id="pago-alumno" class="form-control">
                        ${options}
                    </select>
                </div>

                <div style="display:flex; gap:15px; margin-top: 15px;">
                    <div class="form-group" style="flex:1;">
                        <label>Fecha de Pago</label>
                        <input type="date" id="pago-fecha" class="form-control" value="${today}">
                    </div>
                    
                    <div class="form-group" style="flex:1;">
                        <label>Mes Correspondiente</label>
                        <input type="month" id="pago-mes" class="form-control" value="${today.substring(0, 7)}">
                    </div>

                    <div class="form-group" style="flex:1;">
                        <label>Importe a Cobrar ($)</label>
                        <input type="number" id="pago-importe" class="form-control" value="0" step="0.01">
                    </div>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-primary" id="btn-guardar-pago"><i class="ph ph-check"></i> Confirmar Pago</button>
                </div>
            </div>
        `;
    },

    setupPagosEvents() {
        const selectAlumno = document.getElementById('pago-alumno');
        const inputImporte = document.getElementById('pago-importe');
        const btnGuardar = document.getElementById('btn-guardar-pago');

        if (selectAlumno) {
            selectAlumno.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                if (selectedOption && selectedOption.value !== "") {
                    const importe = selectedOption.getAttribute('data-importe');
                    inputImporte.value = importe;
                } else {
                    inputImporte.value = 0;
                }
            });
        }

        if (btnGuardar) {
            btnGuardar.addEventListener('click', async () => {
                const alumnoId = parseInt(selectAlumno.value);
                const fecha = document.getElementById('pago-fecha').value;
                const mesCorrespondiente = document.getElementById('pago-mes').value;
                const importe = parseFloat(inputImporte.value);

                if (!alumnoId) { alert("Debe seleccionar un alumno."); return; }
                if (!fecha) { alert("Debe seleccionar una fecha."); return; }
                if (!mesCorrespondiente) { alert("Debe indicar a qué mes corresponde este pago."); return; }
                if (isNaN(importe) || importe <= 0) { alert("El importe debe ser mayor a cero."); return; }

                try {
                    btnGuardar.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Registrando...';
                    btnGuardar.disabled = true;

                    await GristData.addRecord('Pagos', {
                        alumno_id: alumnoId,
                        fecha: fecha,
                        mes_correspondiente: mesCorrespondiente,
                        monto_pagado: importe
                    });

                    alert("Pago registrado con éxito.");

                    selectAlumno.value = "";
                    inputImporte.value = 0;
                    document.getElementById('pago-fecha').value = new Date().toISOString().split('T')[0];

                } catch (error) {
                    console.error("Error al registrar pago:", error);
                    alert("Ocurrió un error al registrar el pago.");
                } finally {
                    btnGuardar.innerHTML = '<i class="ph ph-check"></i> Confirmar Pago';
                    btnGuardar.disabled = false;
                }
            });
        }
    }
};
