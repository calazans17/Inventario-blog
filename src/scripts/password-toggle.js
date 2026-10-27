// Botão "Mostrar/Esconder" ao lado dos campos de senha.
for (const button of document.querySelectorAll("[data-toggle=password]")) {
  const input = button.previousElementSibling;
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Esconder" : "Mostrar";
    button.setAttribute("aria-pressed", String(show));
  });
}
