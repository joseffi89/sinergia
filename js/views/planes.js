window.ViewPlanes = {
    async render() {
        const container = document.getElementById('planes-container');
        container.innerHTML = '<p style="color: var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Cargando planes...</p>';

        try {
            const planes = await GristData.getTable('Planes');
            
            if (!planes || !planes.id) {
                container.innerHTML = '<p style="color: var(--danger);">Error al cargar planes.</p>';
                return;
            }

            let cardsHtml = '';
            for(let i=0; i < planes.id.length; i++) {
                cardsHtml += `
                    <div class="card" style="border-top: 4px solid var(--primary); transition: transform 0.2s;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 15px;">
                            <h3 style="font-size: 18px; font-weight: 600;">${planes.nombre_plan[i]}</h3>
                            <span style="font-weight: 700; font-size: 18px; color: var(--primary);">$${planes.importe[i]}</span>
                        </div>
                        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 10px;">
                            <i class="ph ph-clock"></i> ${planes.frecuencia_semanal[i]} veces por semana
                        </p>
                        <div style="margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px; text-align: right;">
                            <button class="btn btn-secondary" style="font-size: 13px;"><i class="ph ph-pencil-simple"></i> Editar</button>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                    ${cardsHtml || '<p style="color: var(--text-muted);">No hay planes creados</p>'}
                </div>
            `;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p style="color: var(--danger);">Ocurrió un error renderizando planes.</p>';
        }
    }
};
