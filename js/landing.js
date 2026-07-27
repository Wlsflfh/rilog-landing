const sectionNavLinks = Array.from(document.querySelectorAll(".landing-section-nav .nav-link"));
const sectionTargets = sectionNavLinks
    .map((link) => {
        const target = document.querySelector(link.hash);
        return target ? { link, target } : null;
    })
    .filter(Boolean);

const setActiveSectionLink = (activeLink) => {
    sectionNavLinks.forEach((link) => {
        const isActive = link === activeLink;
        link.classList.toggle("is-active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "true");
            link.scrollIntoView({ block: "nearest", inline: "nearest" });
            return;
        }

        link.removeAttribute("aria-current");
    });
};

const updateActiveSection = () => {
    if (!sectionTargets.length) {
        return;
    }

    const headerHeight = document.querySelector(".landing-header")?.offsetHeight ?? 0;
    const activationLine = headerHeight + Math.min(window.innerHeight * 0.32, 260);
    let activeSection = sectionTargets[0];

    sectionTargets.forEach((section) => {
        if (section.target.getBoundingClientRect().top <= activationLine) {
            activeSection = section;
        }
    });

    setActiveSectionLink(activeSection.link);
};

let scrollFrame = null;
const requestActiveSectionUpdate = () => {
    if (scrollFrame !== null) {
        return;
    }

    scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        updateActiveSection();
    });
};

sectionNavLinks.forEach((link) => {
    link.addEventListener("click", () => setActiveSectionLink(link));
});

window.addEventListener("scroll", requestActiveSectionUpdate, { passive: true });
window.addEventListener("resize", requestActiveSectionUpdate);
window.addEventListener("load", updateActiveSection);
updateActiveSection();

const lightboxImages = Array.from(document.querySelectorAll(`
    .landing-laptop-screen img,
    .landing-screen-card img,
    .landing-stats-visual img,
    .landing-rureo-evolution img,
    .landing-wide-screen img,
    .landing-org-screen img
`));

if (lightboxImages.length) {
    const lightbox = document.createElement("div");
    lightbox.className = "landing-lightbox";
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.innerHTML = `
        <button class="landing-lightbox-close" type="button" aria-label="확대 이미지 닫기">×</button>
        <figure class="landing-lightbox-frame">
            <img class="landing-lightbox-image" alt="">
        </figure>
    `;

    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector(".landing-lightbox-image");
    const closeButton = lightbox.querySelector(".landing-lightbox-close");
    let lastFocusedElement = null;

    const closeLightbox = () => {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-lightbox-open");

        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    };

    const openLightbox = (image) => {
        lastFocusedElement = document.activeElement;
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt || "확대 이미지";
        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-lightbox-open");
        closeButton.focus();
    };

    lightboxImages.forEach((image) => {
        image.classList.add("landing-expandable-image");
        image.setAttribute("tabindex", "0");
        image.setAttribute("role", "button");
        image.setAttribute("aria-label", `${image.alt || "이미지"} 크게 보기`);

        image.addEventListener("click", () => openLightbox(image));
        image.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openLightbox(image);
            }
        });
    });

    closeButton.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) {
            closeLightbox();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
            closeLightbox();
        }
    });
}
