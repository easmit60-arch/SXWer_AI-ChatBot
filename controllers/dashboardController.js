function assertFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

export function createDashboardController(handlers = {}) {
  const required = ["getHumanRightsReport", "exportData", "deleteData"];
  for (const key of required) {
    assertFunction(handlers[key], `handlers.${key}`);
  }

  return Object.freeze({
    getHumanRightsReport: handlers.getHumanRightsReport,
    exportData: handlers.exportData,
    deleteData: handlers.deleteData,
  });
}
