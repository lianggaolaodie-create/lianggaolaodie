document.addEventListener("DOMContentLoaded", function () {
  const menuButton = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");

  if (!menuButton || !menu) {
    console.log("找不到手機選單");
    return;
  }

  menuButton.addEventListener("click", function () {
    menu.classList.toggle("open");

    const isOpen = menu.classList.contains("open");
    menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      menu.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
});
