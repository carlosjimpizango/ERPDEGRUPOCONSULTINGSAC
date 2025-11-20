sap.ui.define(
  ["sap/ui/core/UIComponent", "sap/ui/model/json/JSONModel"],
  function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("degrupo.app.Component", {
      metadata: {
        manifest: "json"
      },

      init: function () {
        UIComponent.prototype.init.apply(this, arguments);

        // Modelo global para el usuario autenticado + CSRF
        var oUserModel = new JSONModel({
          isLoggedIn: false,
          user: null,
          csrfToken: null // aquí guardamos el token que viene del backend
        });
        this.setModel(oUserModel, "user");

        // Inicializar router
        this.getRouter().initialize();
      }
    });
  }
);
