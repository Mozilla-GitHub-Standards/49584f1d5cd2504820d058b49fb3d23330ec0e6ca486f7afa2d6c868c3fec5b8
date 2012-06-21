"use strict";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://socialapi/modules/baseWidget.js");

Cu.import("resource://socialapi/modules/ProviderRegistry.jsm");



const HTML_NS = "http://www.w3.org/1999/xhtml";

function SocialToolbarStatusArea() {
  baseWidget.call(this, window);

  // we need to make our button appear on first install, for now we always
  // ensure that it is in the toolbar, even if the user removes it
  var navbar = window.document.getElementById("nav-bar");
  var newset = navbar.currentSet + ",social-statusarea-container";
  navbar.currentSet = newset;
  navbar.setAttribute("currentset", newset );
  window.document.persist("nav-bar", "currentset");

  Services.obs.addObserver(this, 'social-browsing-ambient-notification-changed', false);
}

SocialToolbarStatusArea.prototype = {
  __proto__: baseWidget.prototype,

  create: function(aWindow) {
  },

  remove: function() {
  },

  setProvider: function(service) {
    this.debugLog("Setting active service provider to " + service.name);
    this.renderAmbientNotification();
  },

  showAmbientPopup: function(iconImage) {
    var panel = window.document.getElementById("social-notification-panel");
    var notifBrowser = window.document.getElementById("social-notification-browser");
    notifBrowser.service = registry().currentProvider;
    let mutationObserver;

    var sizeToContent = function () {
      let doc = notifBrowser.contentDocument;
      let wrapper = doc && doc.getElementById('notif');
      if (!wrapper) {
        return;
      }
      let h = wrapper.scrollHeight > 0 ? wrapper.scrollHeight : 300;
      notifBrowser.style.width = wrapper.scrollWidth + "px";
      notifBrowser.style.height = h + "px";
    }

    notifBrowser.addEventListener("DOMContentLoaded", function onload() {
      notifBrowser.removeEventListener("DOMContentLoaded", onload);
      let body = notifBrowser.contentDocument.getElementById("notif");
      // We setup a mutation observer on the 'notif' element.  When we
      // get a notification we resize the panel.
      // XXX - drop this check one we only work in FF versions we know have it
      let mo = notifBrowser.contentWindow.MutationObserver || notifBrowser.contentWindow.MozMutationObserver;
      if (mo) {
        mutationObserver = new mo(function(mutations) {
          sizeToContent();
        });
        // configuration of the observer - we want everything that could
        // cause the size to change.
        let config = {attributes: true, childList: true, characterData: true}
        mutationObserver.observe(body, config);
      }
      sizeToContent();
    }, false);
    panel.addEventListener("popuphiding", function onpopuphiding() {
      panel.removeEventListener("popuphiding", onpopuphiding);
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      document.getElementById("social-toolbar").removeAttribute("open");
    }, false);

    notifBrowser.setAttribute("src", iconImage.getAttribute("contentPanel"));
    panel.openPopup(iconImage, "bottomcenter topleft",0,0,false, false);
    document.getElementById("social-toolbar").setAttribute("open", "true");
  },

  renderAmbientNotification: function() {
    var self = this;
    try {
      // create some elements...
      var container = window.document.getElementById("social-toolbar-button");
      // if container is null, it is not in the toolbar
      if (!container)
        return;

      let currentProvider = registry().currentProvider;
      if (!currentProvider || !currentProvider.enabled) {
        this.debugLog("no service is enabled, so not rendering status area");
        return;
      }
      this.debugLog("Rendering toolbar status are; current provider is " + currentProvider.origin);
      if (window.social.enabled) {
        var image = window.document.getElementById("social-statusarea-service-image");
        image.setAttribute("src", currentProvider.iconURL);
      }

      var iconBox = window.document.getElementById("social-statis-iconbox");

      var ambientNotificationCount = 0;
      let iconNames = currentProvider.ambientNotificationIcons ? Object.keys(currentProvider.ambientNotificationIcons) : [];
      for (var i=0; i < iconBox.childNodes.length; i++) {
        let iconContainer = iconBox.childNodes[i];
        if (iconNames.length-1 < i) {
          iconContainer.setAttribute("collapsed", "true");
          continue;
        } else {
          iconContainer.removeAttribute("collapsed");
        }
        let icon = currentProvider.ambientNotificationIcons[iconNames[i]];
        let iconImage = iconContainer.firstChild;
        let iconCounter = iconImage.nextSibling;

        iconImage.setAttribute("contentPanel", icon.contentPanel);
        let imagesrc = /url\(['"](.*)['"]\)/.exec(icon.background)[1];
        iconImage.setAttribute("src", imagesrc);

        if (icon.counter) {
          if (iconCounter.firstChild)
            iconCounter.removeChild(iconCounter.firstChild);
          iconCounter.appendChild(window.document.createTextNode(icon.counter));
          iconCounter.removeAttribute("collapsed");
        } else {
          iconCounter.setAttribute("collapsed", "true");
        }
      }

      let userPortrait = document.getElementById("social-statusarea-popup-current-user-portrait")
      userPortrait.setAttribute("id", "social-statusarea-popup-current-user-portrait");
      if (currentProvider.ambientNotificationPortrait) {
        userPortrait.setAttribute("src", currentProvider.ambientNotificationPortrait);
      } else {
        userPortrait.setAttribute("src", "chrome://socialapi/skin/social.png");
      }

    } catch (e) {
      Cu.reportError(e);
    }
  },

  showPopup: function(event) {
    let btn = document.getElementById('social-statusarea-service-image');
    let panel = document.getElementById("social-statusarea-popup");
    panel.addEventListener("popuphiding", function onpopuphiding() {
      panel.removeEventListener("popuphiding", onpopuphiding);
      document.getElementById("social-toolbar").removeAttribute("open");
    }, false);
    panel.openPopup(btn, "bottomcenter topleft", 0, 0, false, false);
    document.getElementById("social-toolbar").setAttribute("open", "true");
  },

  onpopupshown: function(event) {
    let aWindow = event.target.ownerDocument.defaultView;
    if (aWindow.social.sidebar && aWindow.social.sidebar.browser) {
      aWindow.social.sidebar.browser.setAttribute("toolbar-popup-visible", "true");
    }
  },
  onpopuphidden: function(event) {
    let aWindow = event.target.ownerDocument.defaultView;
    if (aWindow.social.sidebar && aWindow.social.sidebar.browser) {
      aWindow.social.sidebar.browser.removeAttribute("toolbar-popup-visible");
    }
  },
  onpopupshowing: function(event) {
    let aWindow = event.target.ownerDocument.defaultView;
    let popup = aWindow.document.getElementById("social-statusarea-popup");
    buildSocialPopupContents(aWindow, popup);
  },

  disable: function() {
    // reset the image to the default.
    var image = window.document.getElementById("social-statusarea-service-image");
    image.setAttribute("src", "chrome://socialapi/skin/social.png");
  },

  ambientNotificationChanged: function() {
    this.renderAmbientNotification();
  }
}

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function buildSocialPopupContents(window, socialpanel)
{
  let preg = registry();

  function renderNotificationRow(img, title, text) {
    let row = window.document.createElementNS(HTML_NS, "div");
    row.setAttribute("style", "clear:all;cursor:pointer;margin-left:8px;height:32px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:-moz-system-font;border-right:");

    let imgElem = window.document.createElementNS(HTML_NS, "img");
    imgElem.setAttribute("src", img);
    imgElem.setAttribute("style", "width:28px;height:28px;margin-right:8px;float:left");

    let titleElem = window.document.createElementNS(HTML_NS, "span");
    titleElem.appendChild(window.document.createTextNode(title));
    titleElem.setAttribute("style", "font-weight:bold");

    let textElem = window.document.createElementNS(HTML_NS, "span");
    textElem.appendChild(window.document.createTextNode(((text.length > 0 && text[0] != ' ') ? " " : "")+ text));

    row.appendChild(imgElem);
    row.appendChild(titleElem);
    row.appendChild(textElem);
    return row;
  }

  function renderProviderMenuitem(service, container) {

    let menuitem = window.document.createElementNS(HTML_NS, "div");
    menuitem.setAttribute("class", "social-statusarea-popup-menuitem social-statusarea-provider-list");

    let itemText = service.name;

    /* add "(X notifications)"?
    let notificationCount = 0;
    if (service.ambientNotificationIcons) {
      for (var i in service.ambientNotificationIcons) {
        if (service.ambientNotificationIcons[i].counter) {
          notificationCount += service.ambientNotificationIcons[i].counter;
        }
      }
      if (notificationCount)
        itemText += " (" + notificationCount + " notifications)";
    }
    */

    let img = window.document.createElementNS(HTML_NS, "img");
    img.setAttribute("src", service.iconURL);
    menuitem.appendChild(img);

    let label = window.document.createElementNS(HTML_NS, "div");
    label.setAttribute("class", "social-statusarea-provider-list-label");
    label.appendChild(window.document.createTextNode(itemText));
    menuitem.appendChild(label);

    if (service == preg.currentProvider) {
      // no need for a click handler if we're selected
      menuitem.classList.add("social-statusarea-provider-selected");
    }
    else {
      menuitem.addEventListener("click", function(event) {
        preg.currentProvider = service;

        window.document.getElementById("social-statusarea-popup-provider-submenu").hidePopup();
        window.document.getElementById("social-statusarea-popup").hidePopup();

      });
    }
    container.appendChild(menuitem);//insertBefore(menuitem, before);
  }

  try {

    let menuitem;
    let disabled = !window.social.enabled;

    let container = window.document.getElementById("social-statusarea-popup");
    let rootDiv = window.document.getElementById("social-statusarea-user");
    while (rootDiv.firstChild.nextSibling) {
      rootDiv.removeChild(rootDiv.firstChild.nextSibling);
    }

    // if we are disabled we don't want the list of providers nor the separators
    if (disabled) {
      // do something
    } else {
      let makeMenuItem = function(label, extraClass) {
        let menu = window.document.createElementNS(HTML_NS, "div");

        var menuClass = "social-statusarea-popup-menuitem";
        if (extraClass) menuClass += " " + extraClass;
        menu.setAttribute("class", menuClass);
        menu.appendChild(window.document.createTextNode(label));
        return menu;
      }
      var HTML_NS = "http://www.w3.org/1999/xhtml";

      // Render the current user element
      let curUser = window.document.getElementById("social-statusarea-currentuser");
      let userPortrait = window.document.getElementById("social-statusarea-popup-current-user-portrait");

      let userNameLink = window.document.getElementById("social-statusarea-username");
      userNameLink.addEventListener("click", function(evt) {
        gBrowser.selectedTab = gBrowser.addTab(preg.currentProvider.origin);
        evt.stopPropagation();
        window.document.getElementById("social-statusarea-popup").hidePopup();
        return false;
      }, false);

      // Render the menu
      let switchItem = makeMenuItem("Switch social network", "social-statusarea-popup-menuitem-arrow");

      // Re-implementing hierarchical menus here doesn't feel right.
      // Could we get the styling we need with XUL menus?  (probably not: OS X is very hard to style)
      let subMenuVisible = false;
      let inSwitchItem = false;
      let inSubmenu = false;
      let subMenu = window.document.getElementById("social-statusarea-popup-provider-submenu");
      let hideTimer;
      let mouseLeaveGracePeriod = 150; // msec

      let hideIfNecessary = function(evt) {
        if (!inSwitchItem && !inSubmenu && subMenuVisible) {
          subMenu.hidePopup();
          subMenuVisible = false;
        }
      }
      let switchItemMouseEnter = function(evt) {
        inSwitchItem = true;
        if (hideTimer) window.clearTimeout(hideTimer);
        if (!subMenuVisible) {
          subMenu.openPopup(switchItem, "end_before", 0, 0, false, false);
          subMenuVisible = true;
        }
      }

      let switchItemMouseLeave = function(evt) {
        inSwitchItem = false;
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(hideIfNecessary, mouseLeaveGracePeriod);
      }

      let subMenuMouseEnter = function(evt) {
        inSubmenu = true;
        if (hideTimer) window.clearTimeout(hideTimer);
      }
      let subMenuMouseLeave = function(evt) {
        inSubmenu = false;
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(hideIfNecessary, mouseLeaveGracePeriod);
      }
      switchItem.addEventListener("mouseenter", switchItemMouseEnter, false);
      switchItem.addEventListener("mouseleave", switchItemMouseLeave, false);
      subMenu.addEventListener("mouseenter", subMenuMouseEnter, false);
      subMenu.addEventListener("mouseleave", subMenuMouseLeave, false);

      let removeItem = makeMenuItem("Remove from Firefox");
      let shrinkItem = makeMenuItem("Shrink sidebar");
      rootDiv.appendChild(switchItem);
      rootDiv.appendChild(removeItem);
      rootDiv.appendChild(shrinkItem);

      let broadcaster = document.getElementById("socialSidebarVisible");
      if (broadcaster.getAttribute("checked") == "true") {
        let hideItem = makeMenuItem("Hide sidebar");//XXX this doesn't work
        rootDiv.appendChild(hideItem);
        hideItem.addEventListener("click", function() {
          broadcaster.setAttribute("checked", "false");
          broadcaster.setAttribute("hidden", "true");
          window.document.getElementById("social-statusarea-popup").hidePopup();
        }, false);
        rootDiv.appendChild(hideItem);
      } else {
        let showItem = makeMenuItem("Show sidebar");
        rootDiv.appendChild(showItem);
        showItem.addEventListener("click", function() {
          broadcaster.setAttribute("checked", "true");
          broadcaster.setAttribute("hidden", "false");
          window.document.getElementById("social-statusarea-popup").hidePopup();
        }, false);
        rootDiv.appendChild(showItem);
      }

      // Put the list of providers in a submenu:
      while (subMenu.firstChild) subMenu.removeChild(subMenu.firstChild);
      preg.each(function(service) {
        if (service.enabled) {
          let submenuPanel = document.getElementById("social-statusarea-popup-provider-submenu");
          renderProviderMenuitem(service, submenuPanel);
        }
      });

    }
  }
  catch (e) {
    Cu.reportError("Error creating socialpopupcontents: " + e);
    dump(e.stack+"\n");
  }
}
