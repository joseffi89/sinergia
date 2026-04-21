window.ViewTurnos = {
    currentTab: 'tab-calendario',
    actividadesData: null,
    horariosData: null,
    reservasData: null,
    alumnosData: null,
    filtroActividad: '',
    filtroTurno: '',
    filtroAlumnoTurno: '',

    async render() {
        const container = document.getElementById('turnos-container');
        if (!this.actividadesData) {
            container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando...</p>';
        }

        try {
            // Obtener datos
            this.actividadesData = await GristData.getTable('Actividades');
            this.horariosData = await GristData.getTable('Horarios_Base');
            try { this.reservasData = await GristData.getTable('Turnos_Alumnos'); } catch(e) { this.reservasData = { id: [] }; }
            try { this.alumnosData = await GristData.getTable('Alumnos'); } catch(e) { this.alumnosData = { id: [] }; }
            try { this.planesData = await GristData.getTable('Planes'); } catch(e) { this.planesData = { id: [] }; }
            
            if (!this.actividadesData || !this.horariosData) {
                container.innerHTML = '<p style="color: var(--danger);">Error al conectar con Grist o tablas no encontradas.</p>';
                return;
            }

            this.renderTabContent();
        } catch (e) {
            console.error(e);
            container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando turnos.</p>';
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
            container.innerHTML = this.getCalendarioHtml();
        } else if (this.currentTab === 'tab-actividades') {
            container.innerHTML = this.getActividadesHtml();
        } else if (this.currentTab === 'tab-pagos') {
            container.innerHTML = this.getPagosHtml();
            this.setupPagosEvents();
        }
    },

    getCalendarioHtml() {
        const actividades = this.actividadesData;
        const horarios = this.horariosData;
        
        let optionsHtml = '<option value="">Todas las Actividades</option>';
        if (actividades && actividades.id) {
            actividades.id.forEach((id, index) => {
                const selected = (this.filtroActividad == id) ? 'selected' : '';
                optionsHtml += `<option value="${id}" ${selected}>${actividades.nombre_actividad[index]}</option>`;
            });
        }

        const turnosHtml = `
            <option value="" ${this.filtroTurno === '' ? 'selected' : ''}>Todos los turnos</option>
            <option value="mañana" ${this.filtroTurno === 'mañana' ? 'selected' : ''}>Mañana (hasta 12:00)</option>
            <option value="tarde" ${this.filtroTurno === 'tarde' ? 'selected' : ''}>Tarde (12:00 a 18:00)</option>
            <option value="noche" ${this.filtroTurno === 'noche' ? 'selected' : ''}>Noche (desde 18:00)</option>
        `;

        const searchInputHtml = `
            <div style="position:relative; width: 100%; max-width: 250px;">
                <i class="ph ph-magnifying-glass" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
                <input type="text" id="filtro-alumno-turno" class="form-control" placeholder="Buscar alumno..." value="${this.filtroAlumnoTurno}" onkeyup="window.ViewTurnos.aplicarFiltros()" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding-left: 30px;">
            </div>
        `;

        return `
            <div class="calendar-header" style="display:flex; justify-content:space-between; margin-bottom: 20px;">
                <div class="filters" style="display:flex; gap: 10px;">
                    <select id="filtro-actividad" class="form-control" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding: 8px; border-radius: var(--radius);" onchange="window.ViewTurnos.aplicarFiltros()">
                        ${optionsHtml}
                    </select>
                    <select id="filtro-turno" class="form-control" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding: 8px; border-radius: var(--radius);" onchange="window.ViewTurnos.aplicarFiltros()">
                        ${turnosHtml}
                    </select>
                    ${searchInputHtml}
                </div>
            </div>
            <div class="calendar-grid" style="display:grid; grid-template-columns: repeat(6, 1fr); gap: 15px;">
                ${['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'].map(dia => `
                    <div class="calendar-col">
                        <h3 style="text-align:center; padding: 10px; background: var(--bg-card); border-radius: var(--radius); font-size: 14px; border-bottom: 2px solid var(--primary); margin-bottom: 10px;">${dia}</h3>
                        <div class="dia-cards">
                            ${this.renderClasesDia(dia, horarios, actividades)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    aplicarFiltros() {
        this.filtroActividad = document.getElementById('filtro-actividad').value;
        this.filtroTurno = document.getElementById('filtro-turno').value;
        this.filtroAlumnoTurno = document.getElementById('filtro-alumno-turno').value;
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

    renderClasesDia(dia, horarios, actividades) {
        if(!horarios || !horarios.dia_semana) return '';
        
        let clasesDelDia = [];
        for(let i=0; i < horarios.id.length; i++) {
            if (horarios.dia_semana[i] === dia) {
                clasesDelDia.push({
                    id: horarios.id[i],
                    actId: horarios.actividad_id[i],
                    horaInicio: horarios.hora_inicio[i],
                    horaFin: horarios.hora_fin[i]
                });
            }
        }
        
        clasesDelDia.sort((a, b) => {
            const timeA = a.horaInicio ? a.horaInicio.replace(':', '') : '0000';
            const timeB = b.horaInicio ? b.horaInicio.replace(':', '') : '0000';
            return parseInt(timeA) - parseInt(timeB);
        });

        let clasesHtml = '';
        for(const c of clasesDelDia) {
            const actId = c.actId;
            const horaInicio = c.horaInicio;
            
            if (this.filtroActividad && actId.toString() !== this.filtroActividad) continue;

            if (this.filtroTurno && horaInicio) {
                const hora = parseInt(horaInicio.split(':')[0]);
                if (this.filtroTurno === 'mañana' && hora >= 12) continue;
                if (this.filtroTurno === 'tarde' && (hora < 12 || hora >= 18)) continue;
                if (this.filtroTurno === 'noche' && hora < 18) continue;
            }

            if (this.filtroAlumnoTurno) {
                let isEnrolled = false;
                const searchTerm = this.filtroAlumnoTurno.toLowerCase();
                if (this.reservasData && this.reservasData.id) {
                    for (let j=0; j < this.reservasData.id.length; j++) {
                        if (this.reservasData.horario_base_id[j] === c.id) {
                            const alumnoId = this.reservasData.alumno_id[j];
                            if (this.alumnosData && this.alumnosData.id) {
                                const idx = this.alumnosData.id.indexOf(alumnoId);
                                if (idx !== -1) {
                                    const nom = (this.alumnosData.nombre[idx] || '').toLowerCase();
                                    const ape = (this.alumnosData.apellido[idx] || '').toLowerCase();
                                    if (nom.includes(searchTerm) || ape.includes(searchTerm)) {
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

            let actName = "Desc.";
            let color = "var(--primary)";
            let cupoMax = 0;
            
            if (actividades && actividades.id) {
                const actIndex = actividades.id.indexOf(actId);
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

            clasesHtml += `
                <div class="turno-card" style="background: var(--bg-card); border: 1px solid var(--border); padding: 12px; border-radius: var(--radius); margin-bottom: 10px; border-left: 4px solid ${color}; cursor: pointer; transition: transform 0.2s;" onclick="window.ViewTurnos.openGestionClaseModal(${c.id}, ${actId}, '${actName}', '${dia} ${horaInicio}')">
                    <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;"><i class="ph ph-clock"></i> ${c.horaInicio}</div>
                    <div style="font-weight: 500; font-size: 14px; margin-bottom: 8px;">${actName}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Cupos: ${cupoBadge}</span>
                        <div>${extraBadges} <i class="ph ph-users" style="color: var(--text-muted);"></i></div>
                    </div>
                </div>
            `;
        }
        return clasesHtml || '<div style="font-size:12px; text-align:center; color: var(--text-muted); padding: 10px;">Sin clases</div>';
    },

    getActividadesHtml() {
        const actividades = this.actividadesData;
        let rows = '';
        if (actividades && actividades.id && actividades.id.length > 0) {
            for(let i=0; i < actividades.id.length; i++) {
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
        if(!this.actividadesData || !this.actividadesData.id) return;
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
        if(!this.actividadesData || !this.actividadesData.id) return;
        const actId = this.actividadesData.id[index];
        const actName = this.actividadesData.nombre_actividad[index];
        
        // Ensure we have fresh data for the modal
        this.horariosData = await GristData.getTable('Horarios_Base');
        
        // Find existing schedules
        let existingSchedules = [];
        if (this.horariosData && this.horariosData.id) {
            for(let i=0; i < this.horariosData.id.length; i++) {
                if (this.horariosData.actividad_id[i] === actId) {
                    existingSchedules.push({
                        id: this.horariosData.id[i],
                        dia: this.horariosData.dia_semana[i],
                        inicio: this.horariosData.hora_inicio[i],
                        fin: this.horariosData.hora_fin[i]
                    });
                }
            }
        }

        // Sort schedules by day
        const dayOrder = { 'Lunes':1, 'Martes':2, 'Miercoles':3, 'Jueves':4, 'Viernes':5, 'Sabado':6, 'Domingo':7 };
        existingSchedules.sort((a,b) => (dayOrder[a.dia]||9) - (dayOrder[b.dia]||9));

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
                                <td style="padding:8px;">${sch.inicio} - ${sch.fin}</td>
                                <td style="padding:8px; text-align:right;">
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
                        ${['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'].map(dia => `
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
                hora_fin: hora_fin
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
        if(!confirm("¿Seguro que deseas eliminar este horario?")) return;
        try {
            await GristData.deleteRecord('Horarios_Base', horarioId);
            await new Promise(r => setTimeout(r, 600)); // Delay to allow Grist backend to sync
            await this.render(); // Refresh main view
            this.openHorariosModal(actIndex); // Refresh modal
        } catch (e) {
            alert("Error al eliminar horario.");
        }
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
                            alumnoName = `${this.alumnosData.apellido[aIdx]}, ${this.alumnosData.nombre[aIdx]}`;
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

                    enrolled.push({ id: this.reservasData.id[i], name: alumnoName, badge: badge });
                }
            }

            if (enrolled.length > 0) {
                enrolledHtml = `
                    <ul style="list-style:none; padding:0; margin:0 0 20px 0; font-size:13px;">
                        ${enrolled.map(en => `
                            <li style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
                                <span><i class="ph ph-user"></i> ${en.name} ${en.badge}</span>
                                <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; color:var(--danger);" onclick="window.ViewTurnos.bajarAlumno(${en.id}, ${horarioBaseId}, ${actId}, '${actName}', '${horarioLabel}')"><i class="ph ph-trash"></i></button>
                            </li>
                        `).join('')}
                    </ul>
                `;
            } else {
                enrolledHtml = '<p style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">No hay alumnos anotados.</p>';
            }
        }

        // Available students combo box with grouping
        let habilitadosHtml = '<option value="">Seleccionar Alumno...</option>';
        let todosHtml = '<option value="">Seleccionar Alumno...</option>';
        if (this.alumnosData && this.alumnosData.id) {
            this.alumnosData.id.forEach((aid, i) => {
                if (this.alumnosData.estado[i] !== 'Inactivo') {
                    const planId = this.alumnosData.plan_id ? this.alumnosData.plan_id[i] : null;
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

                    const opt = `<option value="${aid}">${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}</option>`;
                    if (allowed) habilitadosHtml += opt;
                    todosHtml += opt;
                }
            });
        }
        
        const formHtml = `
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid var(--border);">Anotados</h4>
                ${enrolledHtml}
            </div>
            
            <div class="form-group">
                <label>Anotar Regular</label>
                <div style="display:flex; gap:10px;">
                    <select id="modal-select-regular" class="form-control" style="flex:1;">
                        ${habilitadosHtml}
                    </select>
                    <button class="btn btn-primary" id="btn-anotar-regular">Anotar</button>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-top: 15px;">
                 <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" id="btn-show-recuperacion">+ Recuperación</button>
                 <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" id="btn-show-excepcion">+ Excepción</button>
            </div>

            <div class="form-group" id="special-enrollment-group" style="display:none; margin-top:15px; padding-top:15px; border-top:1px solid var(--border);">
                <label id="special-enrollment-label" style="color:var(--primary);">Anotar Especial</label>
                <div style="display:flex; gap:10px;">
                    <select id="modal-select-special" class="form-control" style="flex:1;">
                        ${todosHtml}
                    </select>
                    <button class="btn btn-primary" id="btn-anotar-special">Anotar</button>
                </div>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.Modal.close()">Cerrar</button>
        `;

        window.Modal.show(`${actName} - ${horarioLabel}`, formHtml, footerHtml);

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
        if(!confirm("¿Dar de baja a este alumno de la clase?")) return;
        try {
            await GristData.deleteRecord('Turnos_Alumnos', reservaId);
            await new Promise(r => setTimeout(r, 600)); // Delay to allow Grist backend to sync
            await this.render();
            this.openGestionClaseModal(horarioBaseId, actId, actName, horarioLabel);
        } catch(e) {
            alert('Error al eliminar alumno');
        }
    },

    getPagosHtml() {
        let options = '<option value="">Seleccione un alumno...</option>';
        if (this.alumnosData && this.alumnosData.id) {
            this.alumnosData.id.forEach((aid, i) => {
                if (this.alumnosData.estado[i] !== 'Inactivo') {
                    const planId = this.alumnosData.plan_id ? this.alumnosData.plan_id[i] : null;
                    let importePlan = 0;
                    if (planId && this.planesData && this.planesData.id) {
                        const planIdx = this.planesData.id.indexOf(planId);
                        if (planIdx !== -1) {
                            importePlan = this.planesData.importe[planIdx] || 0;
                        }
                    }
                    options += `<option value="${aid}" data-importe="${importePlan}">${this.alumnosData.apellido[i]}, ${this.alumnosData.nombre[i]}</option>`;
                }
            });
        }

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

        if(selectAlumno) {
            selectAlumno.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                if(selectedOption && selectedOption.value !== "") {
                    const importe = selectedOption.getAttribute('data-importe');
                    inputImporte.value = importe;
                } else {
                    inputImporte.value = 0;
                }
            });
        }

        if(btnGuardar) {
            btnGuardar.addEventListener('click', async () => {
                const alumnoId = parseInt(selectAlumno.value);
                const fecha = document.getElementById('pago-fecha').value;
                const mesCorrespondiente = document.getElementById('pago-mes').value;
                const importe = parseFloat(inputImporte.value);

                if(!alumnoId) { alert("Debe seleccionar un alumno."); return; }
                if(!fecha) { alert("Debe seleccionar una fecha."); return; }
                if(!mesCorrespondiente) { alert("Debe indicar a qué mes corresponde este pago."); return; }
                if(isNaN(importe) || importe <= 0) { alert("El importe debe ser mayor a cero."); return; }

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

                } catch(error) {
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
