const GristData = {
    isReady: false,
    userRole: 'admin', // Default o mock

    async init() {
        // Inicializa la conexión con Grist
        grist.ready({
            requiredAccess: 'full' // Necesitamos acceso full para ABM
        });

        grist.onRecords(() => {
            if(!this.isReady) {
                this.isReady = true;
                console.log("Grist API conectada y datos recibidos");
                if (window.App && window.App.currentView) {
                    window.App.loadView(window.App.currentView);
                }
            }
        });

        // Fallback timeout in case onRecords doesn't fire
        setTimeout(() => {
            if(!this.isReady) {
                this.isReady = true;
                console.log("Grist timeout alcanzado, forzando renderizado");
                if (window.App && window.App.currentView) window.App.loadView(window.App.currentView);
            }
        }, 1500);
    },

    async getTable(tableName) {
        if (!this.isReady) return { id: [] }; // Mock empty if not ready
        try {
            const data = await grist.docApi.fetchTable(tableName);
            // Ensure data has .id to prevent errors
            if (!data.id) data.id = [];
            return data;
        } catch (error) {
            console.error(`Error al obtener tabla ${tableName}:`, error);
            return { id: [] }; // Prevent crash on view
        }
    },

    async addRecord(tableName, data) {
        try {
            return await grist.docApi.applyUserActions([
                ['AddRecord', tableName, null, data]
            ]);
        } catch (error) {
            console.error(`Error al agregar registro en ${tableName}:`, error);
            throw error;
        }
    },

    async updateRecord(tableName, id, data) {
        try {
            return await grist.docApi.applyUserActions([
                ['UpdateRecord', tableName, id, data]
            ]);
        } catch (error) {
            console.error(`Error al actualizar registro ${id} en ${tableName}:`, error);
            throw error;
        }
    },

    async deleteRecord(tableName, id) {
        try {
            return await grist.docApi.applyUserActions([
                ['RemoveRecord', tableName, id]
            ]);
        } catch (error) {
            console.error(`Error al eliminar registro ${id} en ${tableName}:`, error);
            throw error;
        }
    }
};
