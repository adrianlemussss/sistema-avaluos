"use strict";
const menuPublico = document.querySelector(".menu-publico-toggle");
const navegacionPublica = document.getElementById("navegacion-publica");
function cerrarMenuPublico() {
  menuPublico.setAttribute("aria-expanded", "false");
  navegacionPublica.classList.remove("abierta");
}
menuPublico.addEventListener("click", () => {
  const abierta = menuPublico.getAttribute("aria-expanded") !== "true";
  menuPublico.setAttribute("aria-expanded", String(abierta));
  navegacionPublica.classList.toggle("abierta", abierta);
});
navegacionPublica
  .querySelectorAll("a")
  .forEach((a) => a.addEventListener("click", cerrarMenuPublico));
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    menuPublico.getAttribute("aria-expanded") === "true"
  ) {
    cerrarMenuPublico();
    menuPublico.focus();
  }
});
