window.ViewTurnos = {
    async render() {
        const container = document.getElementById('turnos-container');
        container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando calendario...</p>';

        try {
            // Obtener datos
            const actividades = await GristData.getTable('Actividades');
            const horarios = await GristData.getTable('Horarios_Base');
            
            if (!actividades || !horarios) {
                container.innerHTML = '<p style="color: var(--danger);">Error al conectar con Grist o tablas no encontradas.</p>';
                return;
            }

            // Construir UI
            let html = `
                <div class="calendar-header" style="display:flex; justify-content:space-between; margin-bottom: 20px;">
                    <div class="filters">
                        <select class="form-control" style="background: var(--bg-card); color: white; border: 1px solid var(--border); padding: 8px; border-radius: var(--radius);">
                            <option value="">Todas las Actividades</option>
                            ${actividades.id.map((id, index) => `<option value="${id}">${actividades.nombre_actividad[index]}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="calendar-grid" style="display:grid; grid-template-columns: repeat(6, 1fr); gap: 15px;">
                    <!-- Dias de la semana (Lun a Sab) -->
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
            container.innerHTML = html;

        } catch (e) {
            console.error(e);
            container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando turnos.</p>';
        }
    },

    renderClasesDia(dia, horarios, actividades) {
        if(!horarios.dia_semana) return '';
        
        let clasesHtml = '';
        for(let i=0; i < horarios.id.length; i++) {
            if (horarios.dia_semana[i] === dia) {
                // Find actividad details
                const actId = horarios.actividad_id[i];
                let actName = "Desc.";
                let color = "var(--primary)";
                
                const actIndex = actividades.id.indexOf(actId);
                if (actIndex !== -1) {
                    actName = actividades.nombre_actividad[actIndex];
                    color = actividades.color_ui[actIndex] || color;
                }

                clasesHtml += `
                    <div class="turno-card" style="background: var(--bg-card); border: 1px solid var(--border); padding: 12px; border-radius: var(--radius); margin-bottom: 10px; border-left: 4px solid ${color}; cursor: pointer; transition: transform 0.2s;">
                        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;"><i class="ph ph-clock"></i> ${horarios.hora_inicio[i]} - ${horarios.hora_fin[i]}</div>
                        <div style="font-weight: 500; font-size: 14px; margin-bottom: 8px;">${actName}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Cupos: N/A</span>
                            <i class="ph ph-users" style="color: var(--text-muted);"></i>
                        </div>
                    </div>
                `;
            }
        }
        return clasesHtml || '<div style="font-size:12px; text-align:center; color: var(--text-muted); padding: 10px;">Sin clases</div>';
    }
};
