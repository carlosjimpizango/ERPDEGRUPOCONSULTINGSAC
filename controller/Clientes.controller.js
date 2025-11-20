sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
  ],
  function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("degrupo.app.controller.Clientes", {
      onInit: function () {
        // Modelo local para lista y formulario
        var oModel = new JSONModel({
          items: [],
          form: {
            cliente_id: null,
            nombre: "",
            tipo_documento: "",
            numero_documento: "",
            correo: "",
            telefono: "",
            direccion: ""
          }
        });
        this.getView().setModel(oModel, "clientes");

        // Cargar clientes al iniciar
        this._cargarClientes();
      },

      _getClientesModel: function () {
        return this.getView().getModel("clientes");
      },

      // 🔐 Helper para obtener el CSRF desde el modelo user
      _getCsrfToken: function () {
        var oUserModel = this.getOwnerComponent().getModel("user");
        if (!oUserModel) {
          return null;
        }
        return oUserModel.getProperty("/csrfToken");
      },

      _resetForm: function () {
        var oModel = this._getClientesModel();
        oModel.setProperty("/form", {
          cliente_id: null,
          nombre: "",
          tipo_documento: "",
          numero_documento: "",
          correo: "",
          telefono: "",
          direccion: ""
        });

        // Quitar selección de la tabla
        var oTable = this.byId("tablaClientes");
        if (oTable) {
          oTable.removeSelections(true);
        }
      },

      _cargarClientes: function () {
        var that = this;
        jQuery.ajax({
          url: "http://localhost:3000/api/clientes",
          method: "GET",
          xhrFields: { withCredentials: true },
          success: function (data) {
            var oModel = that._getClientesModel();
            oModel.setProperty("/items", data || []);
          },
          error: function (jqXHR) {
            var msg = "Error al cargar clientes.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
              msg = jqXHR.responseJSON.message;
            }
            MessageBox.error(msg);
          }
        });
      },

      onNuevo: function () {
        this._resetForm();
        MessageToast.show("Formulario listo para nuevo cliente.");
      },

      onSeleccionarCliente: function (oEvent) {
        var oItem = oEvent.getParameter("listItem");
        if (!oItem) {
          return;
        }
        var oContext = oItem.getBindingContext("clientes");
        if (!oContext) {
          return;
        }
        var oData = Object.assign({}, oContext.getObject());

        var oModel = this._getClientesModel();
        oModel.setProperty("/form", oData);

        MessageToast.show("Cliente cargado en el formulario para edición.");
      },

      _validarForm: function (oForm) {
        if (!oForm.nombre || oForm.nombre.trim().length < 3) {
          MessageToast.show(
            "El nombre es obligatorio y debe tener al menos 3 caracteres."
          );
          return false;
        }
        return true;
      },

      onGuardar: function () {
        var that = this;
        var oModel = this._getClientesModel();
        var oForm = Object.assign({}, oModel.getProperty("/form"));

        if (!this._validarForm(oForm)) {
          return;
        }

        // 🔐 Obtener CSRF token
        var sCsrf = this._getCsrfToken();
        if (!sCsrf) {
          MessageBox.error(
            "La sesión ha expirado o es inválida. Por favor, inicie sesión nuevamente."
          );
          this.getOwnerComponent().getRouter().navTo("Login");
          return;
        }

        var payload = {
          nombre: oForm.nombre.trim(),
          tipo_documento: oForm.tipo_documento || null,
          numero_documento: oForm.numero_documento || null,
          correo: oForm.correo || null,
          telefono: oForm.telefono || null,
          direccion: oForm.direccion || null,
          activo: true
        };

        var bEsEdicion = !!oForm.cliente_id;
        var sUrl = "http://localhost:3000/api/clientes";
        var sMetodo = "POST";

        if (bEsEdicion) {
          sUrl += "/" + oForm.cliente_id;
          sMetodo = "PUT";
        }

        jQuery.ajax({
          url: sUrl,
          method: sMetodo,
          xhrFields: { withCredentials: true },
          contentType: "application/json",
          headers: {
            "X-CSRF-Token": sCsrf // 🔐 CSRF en POST/PUT
          },
          data: JSON.stringify(payload),
          success: function (data) {
            if (bEsEdicion) {
              MessageToast.show("Cliente actualizado correctamente.");
            } else {
              MessageToast.show("Cliente creado correctamente.");
            }

            oModel.setProperty("/form", data);
            that._cargarClientes();
          },
          error: function (jqXHR) {
            var msg = "Error al guardar el cliente.";
            if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
              msg = jqXHR.responseJSON.message;
            } else if (jqXHR.responseJSON && jqXHR.responseJSON.errors) {
              msg = jqXHR.responseJSON.errors.join("\n");
            }
            MessageBox.error(msg);
          }
        });
      },

      onCancelar: function () {
        this._resetForm();
        MessageToast.show("Edición cancelada.");
      },

      onEliminar: function () {
        var that = this;
        var oTable = this.byId("tablaClientes");
        var oSelected = oTable.getSelectedItem();

        if (!oSelected) {
          MessageToast.show("Seleccione un cliente para eliminar.");
          return;
        }

        // 🔐 CSRF para DELETE
        var sCsrf = this._getCsrfToken();
        if (!sCsrf) {
          MessageBox.error(
            "La sesión ha expirado o es inválida. Por favor, inicie sesión nuevamente."
          );
          this.getOwnerComponent().getRouter().navTo("Login");
          return;
        }

        var oContext = oSelected.getBindingContext("clientes");
        var oData = oContext.getObject();

        MessageBox.confirm(
          "¿Seguro que desea desactivar (eliminar lógicamente) al cliente: " +
            oData.nombre +
            "?",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                return;
              }

              jQuery.ajax({
                url:
                  "http://localhost:3000/api/clientes/" + oData.cliente_id,
                method: "DELETE",
                xhrFields: { withCredentials: true },
                headers: {
                  "X-CSRF-Token": sCsrf // 🔐 CSRF en DELETE
                },
                success: function () {
                  MessageToast.show("Cliente desactivado correctamente.");
                  that._resetForm();
                  that._cargarClientes();
                },
                error: function (jqXHR) {
                  var msg = "Error al desactivar el cliente.";
                  if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
                    msg = jqXHR.responseJSON.message;
                  }
                  MessageBox.error(msg);
                }
              });
            }
          }
        );
      },

      onLogout: function () {
        var that = this;

        var sCsrf = this._getCsrfToken();
        if (!sCsrf) {
          // Si no hay token, asumimos sesión expirada y solo limpiamos frontend
          var oUserModel = this.getOwnerComponent().getModel("user");
          if (oUserModel) {
            oUserModel.setProperty("/isLoggedIn", false);
            oUserModel.setProperty("/user", null);
            oUserModel.setProperty("/csrfToken", null);
          }
          this.getOwnerComponent().getRouter().navTo("Login");
          MessageToast.show("Sesión inválida o expirada. Inicie sesión nuevamente.");
          return;
        }

        jQuery.ajax({
          url: "http://localhost:3000/api/auth/logout",
          method: "POST",
          xhrFields: { withCredentials: true },
          headers: {
            "X-CSRF-Token": sCsrf // 🔐 CSRF también en logout
          },
          success: function () {
            MessageToast.show("Sesión cerrada correctamente.");
            // Limpiar modelo de usuario
            var oUserModel = that.getOwnerComponent().getModel("user");
            if (oUserModel) {
              oUserModel.setProperty("/isLoggedIn", false);
              oUserModel.setProperty("/user", null);
              oUserModel.setProperty("/csrfToken", null);
            }
            // Navegar al Login
            that.getOwnerComponent().getRouter().navTo("Login");
          },
          error: function () {
            MessageBox.warning(
              "Se intentó cerrar la sesión, pero ocurrió un error. Intente nuevamente."
            );
          }
        });
      }
    });
  }
);
