/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
import {
  Context,
  $
} from '../../context'

global.jQuery = $
import 'jquery-ui-dist/jquery-ui'

// Uses: jQuery UI Dialog
// https://jqueryui.com/dialog/
interface IDialogElem extends JQuery<HTMLElement> {
  dialog: Function
}

interface IButton extends JQuery<HTMLElement> {
  button: Function
}

export class User extends Context {
  public loggedIn: boolean = false
  constructor() {
    super()
    const { ctx } = this

    if (ctx.settings.user) {
      if (!ctx.settings.editorTheme || !ctx.settings.editorTheme.hasOwnProperty("userMenu")) {

        var userMenu = $('<li><a id="btn-usermenu" class="button hide" data-toggle="dropdown" href="#"></a></li>')
          .prependTo(".header-toolbar");
        if (ctx.settings.user.image) {
          $('<span class="user-profile"></span>').css({
            backgroundImage: "url(" + ctx.settings.user.image + ")",
          }).appendTo(userMenu.find("a"));
        } else {
          $('<i class="fa fa-user"></i>').appendTo(userMenu.find("a"));
        }

        ctx.menu.init({
          id: "btn-usermenu",
          options: []
        });
        this.updateUserMenu();
      }
    }
  }

  onLoginSuccess({ resolve, reject, data, opts }) {
    const {
      ctx
    } = this
    const {
      updateUserMenu
    } = this.rebind([
        'updateUserMenu'
      ])
    const user = this
    let i
    if (data.type == "credentials") {
      for (; i < data.prompts.length; i++) {
        var field = data.prompts[i];
        var row = $("<div/>", {
          class: "form-row"
        });
        $('<label for="node-dialog-login-' + field.id + '">' + ctx._(field.label) + ':</label><br/>').appendTo(row);
        var input = $('<input style="width: 100%" id="node-dialog-login-' + field.id + '" type="' + field.type + '" tabIndex="' + (i + 1) + '"/>').appendTo(row);

        if (i < data.prompts.length - 1) {
          input.keypress(
            (function () {
              var r = row;
              return function (event) {
                if (event.keyCode == 13) {
                  r.next("div").find("input").focus();
                  event.preventDefault();
                }
              }
            })()
          );
        }
        row.appendTo("#node-dialog-login-fields");
      }
      $('<div class="form-row" style="text-align: right; margin-top: 10px;"><span id="node-dialog-login-failed" style="line-height: 2em;float:left;" class="hide">' + ctx._("user.loginFailed") + '</span><img src="red/images/spin.svg" style="height: 30px; margin-right: 10px; " class="login-spinner hide"/>' +
        (opts.cancelable ? '<a href="#" id="node-dialog-login-cancel" style="margin-right: 20px;" tabIndex="' + (i + 1) + '">' + ctx._("common.label.cancel") + '</a>' : '') +
        '<input type="submit" id="node-dialog-login-submit" style="width: auto;" tabIndex="' + (i + 2) + '" value="' + ctx._("user.login") + '"></div>').appendTo("#node-dialog-login-fields");


      const buttonElem = <IButton>$("#node-dialog-login-submit")
      buttonElem.button();
      $("#node-dialog-login-fields").submit((event) => {
        buttonElem.button("option", "disabled", true);
        $("#node-dialog-login-failed").hide();
        $(".login-spinner").show();

        var body = {
          client_id: "node-red-editor",
          grant_type: "password",
          scope: ""
        }
        for (var i = 0; i < data.prompts.length; i++) {
          var field = data.prompts[i];
          body[field.id] = $("#node-dialog-login-" + field.id).val();
        }
        $.ajax({
          url: "auth/token",
          type: "POST",
          data: body
        }).done((data, textStatus, xhr) => {
          ctx.settings.set("auth-tokens", data);
          const loginDialog = <IDialogElem>$("#node-dialog-login")
          loginDialog.dialog('destroy').remove();
          if (opts.updateMenu) {
            updateUserMenu();
          }
          user.loggedIn = true
          resolve({ loggedIn: user.loggedIn });
        }).fail((jqXHR, textStatus, errorThrown) => {
          ctx.settings.remove("auth-tokens");
          $("#node-dialog-login-failed").show();
          user.loggedIn = false
          resolve({ loggedIn: user.loggedIn });
        }).always(() => {
          buttonElem.button("option", "disabled", false);
          $(".login-spinner").hide();
        });
        event.preventDefault();
      });

    } else if (data.type == "strategy") {
      i = 0;
      for (; i < data.prompts.length; i++) {
        var field = data.prompts[i];
        var row = $("<div/>", {
          class: "form-row",
          style: "text-align: center"
        }).appendTo("#node-dialog-login-fields");

        var loginButton = <IButton>$('<a href="#"></a>', {
          style: "padding: 10px"
        }).appendTo(row).click(function () {
          // document.location = field.url;
          // TODO: FIX ME!
          throw Error('user: login - trying to set document location!!')
        });
        if (field.image) {
          $("<img>", {
            src: field.image
          }).appendTo(loginButton);
        } else if (field.label) {
          var label = $('<span></span>').text(field.label);
          if (field.icon) {
            $('<i></i>', {
              class: "fa fa-2x " + field.icon,
              style: "vertical-align: middle"
            }).appendTo(loginButton);
            label.css({
              "verticalAlign": "middle",
              "marginLeft": "8px"
            });

          }
          label.appendTo(loginButton);
        }
        loginButton.button();
      }
    }
  }


  async login(opts) {
    const {
      ctx,
      updateUserMenu
    } = this.rebind([
        'updateUserMenu'
      ])

    if (typeof opts == 'function') {
      opts = {};
    }

    var dialog = <IDialogElem>$('<div id="node-dialog-login" class="hide">' +
      '<div style="display: inline-block;width: 250px; vertical-align: top; margin-right: 10px; margin-bottom: 20px;"><img id="node-dialog-login-image" src=""/></div>' +
      '<div style="display: inline-block; width: 250px; vertical-align: bottom; margin-left: 10px; margin-bottom: 20px;">' +
      '<form id="node-dialog-login-fields" class="form-horizontal" style="margin-bottom: 0px;"></form>' +
      '</div>' +
      '</div>');

    dialog.dialog({
      autoOpen: false,
      dialogClass: "ui-dialog-no-close",
      modal: true,
      closeOnEscape: !!opts.cancelable,
      width: 600,
      resizable: false,
      draggable: false
    });

    $("#node-dialog-login-fields").empty();
    const user = this

    return new Promise((reject, resolve) => {
      $.ajax({
        dataType: "json",
        url: "auth/login",
        success: (data) => {
          var i = 0;
          this.onLoginSuccess({ resolve, reject, data, opts })

          if (opts.cancelable) {
            const cancelButton = <IButton>$("#node-dialog-login-cancel")

            cancelButton.button().click(function (event) {
              const loginDialog = <IDialogElem>$("#node-dialog-login")
              loginDialog.dialog('destroy').remove();
            });
          }

          var loginImageSrc = data.image || "red/images/node-red-256.png";

          // TODO: fix
          const loadUrl = 'unknown'
          const loadData = {}
          $("#node-dialog-login-image").load(loadUrl, loadData, () => {
            dialog.dialog("open");
          }).attr("src", loginImageSrc);
        },
        error: (jqXHR: any, textStatus: string, errorThrown: string) => {
          user.handleError(`login: ${textStatus}`, {
            jqXHR
          })
          throw new Error(errorThrown)
        }
      });
    })
  }

  async logout() {
    const {
      ctx
    } = this
    var tokens = ctx.settings.get("auth-tokens");
    var token = tokens ? tokens.access_token : "";
    const user = this
    return new Promise((reject, resolve) => {
      $.ajax({
        url: "auth/revoke",
        type: "POST",
        data: {
          token: token
        }
      }).done((data, textStatus, xhr) => {
        ctx.settings.remove("auth-tokens");
        if (data && data.redirect) {
          document.location.href = data.redirect;
        } else {
          document.location.reload(true);
        }
        user.loggedIn = false
        resolve({ loggedOut: !user.loggedIn })
      }).fail((jqXHR, textStatus, errorThrown) => {
        if (jqXHR.status === 401) {
          document.location.reload(true);
        } else {
          console.log(textStatus);
        }
        user.loggedIn = true
        reject({ loggedOut: !user.loggedIn })
      })
    })
  }

  updateUserMenu() {
    const {
      ctx,
      updateUserMenu
    } = this.rebind([
        'updateUserMenu'
      ])

    $("#btn-usermenu-submenu li").remove();
    if (ctx.settings.user.anonymous) {
      ctx.menu.addItem("btn-usermenu", {
        id: "usermenu-item-login",
        label: ctx._("menu.label.login"),
        onselect: () => {
          ctx.user.login({
            cancelable: true
          }, () => {
            ctx.settings.load(function () {
              ctx.notify(ctx._("user.loggedInAs", {
                name: ctx.settings.user.username
              }), "success");
              updateUserMenu();
            });
          });
        }
      });
    } else {
      ctx.menu.addItem("btn-usermenu", {
        id: "usermenu-item-username",
        label: "<b>" + ctx.settings.user.username + "</b>"
      });
      ctx.menu.addItem("btn-usermenu", {
        id: "usermenu-item-logout",
        label: ctx._("menu.label.logout"),
        onselect: function () {
          ctx.user.logout();
        }
      });
    }
    return this
  }
}
