const CONTACT_EMAIL = "vishaly5@outlook.com";

function buildAboutPanelOptions() {
  return {
    applicationName: "Open Money",
    copyright: "Copyright © Open Money",
    credits: `Contact: ${CONTACT_EMAIL}`
  };
}

function buildApplicationMenuTemplate({ platform, shell }) {
  const isMac = platform === "darwin";

  return [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Contact…",
          click: () => {
            void shell.openExternal(`mailto:${CONTACT_EMAIL}`);
          }
        }
      ]
    }
  ];
}

module.exports = {
  CONTACT_EMAIL,
  buildAboutPanelOptions,
  buildApplicationMenuTemplate
};
