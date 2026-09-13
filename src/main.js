import { createClient } from "@supabase/supabase-js";
import { runLegacy } from "./generated/app-legacy.js";

window.supabase = { createClient };
runLegacy();

document.querySelectorAll("[data-navigate]").forEach((element) => {
  element.addEventListener("click", () => {
    const destination = element.dataset.navigate;
    if (typeof window.ttbkNavigate === "function") window.ttbkNavigate(destination);
    else window.location.href = destination;
  });
});