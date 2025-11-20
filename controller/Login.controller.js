sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
  ],
  function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("degrupo.app.controller.Login", {
      onInit: function () {
        this._captchaId = null;
        this._cargarCaptcha();
      },

      _cargarCaptcha: function () {
        var that = this;
        jQuery.ajax({
          url: "http://localhost:3000/api/auth/captcha",
          method: "GET",
          xhrFields: { withCredentials: true },
          success: function (data) {
            that._captchaId = data.id;
            that.byId("txtCaptchaPregunta").setText(data.question);
            that.byId("inpCaptcha").setValue("");
          },
          error: function () {
            that.byId("txtCaptchaPregunta").setText(
              "Error al cargar captcha. Intente nuevamente."
            );
          }
        });
      },

      onRefrescarCaptcha: function () {
        this._cargarCaptcha();
      },

      _validate: function (usuario, password, captchaRespuesta) {
        if (!usuario || usuario.length < 3) {
          MessageToast.show("Ingrese un usuario válido.");
          return false;
        }
        if (!password || password.length < 8) {
          MessageToast.show(
            "La contraseña debe tener al menos 8 caracteres."
          );
          return false;
        }
        if (!captchaRespuesta || captchaRespuesta.trim().length === 0) {
          MessageToast.show("Ingrese la respuesta al captcha.");
          return false;
        }
        return true;
      },

      onLoginPress: function () {
        var that = this;

        var usuario = this.byId("inpUsuario").getValue().trim();
        var password = this.byId("inpPassword").getValue();
        var captchaRespuesta = this.byId("inpCaptcha").getValue();

        if (!this._validate(usuario, password, captchaRespuesta)) {
          return;
        }

        var oPayload = {
          usuario: usuario,
          password: password,
          captchaId: this._captchaId,
          captchaRespuesta: captchaRespuesta
        };

        var sUrl = "http://localhost:3000/api/auth/login";

        jQuery.ajax({
          url: sUrl,
          method: "POST",
          xhrFields: { withCredentials: true }, // cookie sid
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (data) {
            // limpiar campos sensibles
            that.byId("inpPassword").setValue("");
            that.byId("inpCaptcha").setValue("");

            MessageToast.show("Bienvenido " + data.user.UsuarioLogin);

            var oUserModel = that.getOwnerComponent().getModel("user");
            oUserModel.setProperty("/isLoggedIn", true);
            oUserModel.setProperty("/user", data.user);

            // 🔐 Guardar CSRF token para usarlo en POST/PUT/DELETE
            if (data.csrfToken) {
              oUserModel.setProperty("/csrfToken", data.csrfToken);
            } else {
              // por seguridad, si no viene token, lo marcamos nulo
              oUserModel.setProperty("/csrfToken", null);
            }

            // Navegar a clientes
            that.getOwnerComponent().getRouter().navTo("Clientes");
          },
          error: function (jqXHR) {
            that.byId("inpPassword").setValue("");
            that.byId("inpCaptcha").setValue("");

            // Nuevo captcha en cada error
            that._cargarCaptcha();

            var msg = "Error al iniciar sesión.";
            if (jqXHR.status === 429 && jqXHR.responseJSON?.message) {
              msg = jqXHR.responseJSON.message;
            } else if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
              msg = jqXHR.responseJSON.message;
            }
            MessageBox.error(msg);
          }
        });
      }
    });
  }
);
