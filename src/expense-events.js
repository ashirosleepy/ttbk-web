const callExpense = (name, ...args) => {
  const handler = window[name];
  if (typeof handler === "function") handler(...args);
};

document.querySelectorAll("[data-navigate]").forEach((element) => {
  element.addEventListener("click", () => {
    const destination = element.dataset.navigate;
    if (typeof window.ttbkNavigate === "function") window.ttbkNavigate(destination);
    else window.location.href = destination;
  });
});

document.querySelectorAll("[data-init-member]").forEach((input) => {
  input.addEventListener("input", () => callExpense("updateInitValue", input.dataset.initMember, input.value));
});

document.addEventListener("click", (event) => {
  const element = event.target.closest("[data-expense-action]");
  if (!element) return;

  switch (element.dataset.expenseAction) {
    case "export-json": callExpense("exportJSON"); break;
    case "open-import": document.getElementById("importFile")?.click(); break;
    case "export-pdf": callExpense("exportPDF"); break;
    case "export-csv": callExpense("exportCSV"); break;
    case "add-year": callExpense("addNewYear"); break;
    case "save-fund": callExpense("saveInitFund"); break;
    case "add-expense": callExpense("addExpense"); break;
    case "add-transfer": callExpense("addTransfer"); break;
    case "close-expense-modal": callExpense("closeEditModal"); break;
    case "save-edit-expense": callExpense("saveEditExpense"); break;
    case "edit-expense": callExpense("openEditModal", Number(element.dataset.index)); break;
    case "delete-expense": callExpense("deleteExpense", Number(element.dataset.index)); break;
    case "close-transfer-modal": callExpense("closeEditTransferModal"); break;
    case "save-edit-transfer": callExpense("saveEditTransfer"); break;
    case "edit-transfer": callExpense("openEditTransferModal", Number(element.dataset.index)); break;
    case "delete-transfer": callExpense("deleteTransfer", Number(element.dataset.index)); break;
    default: break;
  }
});

document.getElementById("importFile")?.addEventListener("change", (event) => {
  callExpense("importJSON", event);
});

document.getElementById("year-select")?.addEventListener("change", (event) => {
  callExpense("switchYear", Number.parseInt(event.target.value, 10));
});