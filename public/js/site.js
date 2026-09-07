export const SITE = Object.freeze({
  name: "IleSztuk.pl",
  legalBusinessName: "Marcin Molenda",
  address: "Józefów, Wrzosowa, nr 17, 05-420",
  nip: "5252298622",
  email: "kontakt@ilesztuk.pl",
});

export function siteFooterMarkup() {
  return `
    <div class="footer-inner">
      <div class="footer-brand"><strong>${SITE.name}</strong></div>
      <address class="footer-business">
        <span>${SITE.legalBusinessName}</span>
        <span>NIP: ${SITE.nip}</span>
      </address>
      <nav class="footer-contact" aria-label="Informacje prawne i kontakt">
        <a class="footer-email" href="mailto:${SITE.email}">${SITE.email}</a>
        <div class="footer-legal-links"><a href="/regulamin">Regulamin</a><a href="/polityka-prywatnosci">Polityka prywatności</a></div>
      </nav>
    </div>
  `;
}

export function fillSiteInformation(root = document) {
  root.querySelectorAll("[data-site-info]").forEach((element) => {
    const value = SITE[element.dataset.siteInfo];
    if (value) {
      element.textContent = value;
    }
  });
  root.querySelectorAll("[data-site-email-link]").forEach((element) => {
    element.href = `mailto:${SITE.email}`;
    element.textContent = SITE.email;
  });
}
