const sourceList =
    document.getElementById("sourceList");

const addSourceBtn =
    document.getElementById("addSourceBtn");

const sourceForm =
    document.getElementById("sourceForm");

const sourceLink =
    document.getElementById("sourceLink");

const sourceMessage =
    document.getElementById("sourceMessage");

const backBtn =
    document.getElementById("backBtn");


let currentUser = null;


/* LOAD USER */

async function loadUser() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (
            !data.loggedIn ||
            !data.user
        ) {
            window.location.href = "/";
            return;
        }

        currentUser =
            data.user;

        if (
            currentUser.role !== "founder"
        ) {
            addSourceBtn.style.display =
                "none";
        }

        loadSources();

    } catch (error) {

        window.location.href = "/";

    }
}


/* LOAD SOURCES */

async function loadSources() {

    try {

        const response =
            await fetch(
                "/api/sources",
                {
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            sourceList.innerHTML =
                `<div class="source-empty">
                    Gagal memuat source.
                </div>`;

            return;
        }

        const sources =
            data.sources || [];

        if (sources.length === 0) {

            sourceList.innerHTML =
                `<div class="source-empty">
                    Belum ada Discord Source.
                </div>`;

            return;
        }

        sourceList.innerHTML = "";

        sources.forEach(function(source) {

            const item =
                document.createElement("div");

            item.className =
                "source-item";

            item.innerHTML = `
                <div class="source-info">
                    <strong>
                        Discord Source
                    </strong>

                    <span>
                        ${escapeHTML(source.link)}
                    </span>
                </div>

                <a
                    href="${escapeAttribute(source.link)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="source-join-btn"
                >
                    JOIN
                </a>
            `;

            sourceList.appendChild(item);

        });

    } catch (error) {

        sourceList.innerHTML =
            `<div class="source-empty">
                Gagal terhubung ke server.
            </div>`;

    }
}


/* ADD BUTTON */

addSourceBtn.addEventListener(
    "click",
    function() {

        if (
            !currentUser ||
            currentUser.role !== "founder"
        ) {
            return;
        }

        sourceForm.style.display =
            "block";

        sourceLink.focus();

    }
);


/* ADD SOURCE */

sourceForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const link =
            sourceLink.value.trim();

        if (!link) {
            return;
        }

        sourceMessage.textContent =
            "Menambahkan...";

        sourceMessage.style.color =
            "#aaa";

        try {

            const response =
                await fetch(
                    "/api/source",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            link: link
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                sourceMessage.textContent =
                    data.message ||
                    "Gagal menambahkan source.";

                sourceMessage.style.color =
                    "#ff5555";

                return;
            }

            sourceMessage.textContent =
                "Source berhasil ditambahkan.";

            sourceMessage.style.color =
                "#ff7a00";

            sourceLink.value = "";

            await loadSources();

        } catch (error) {

            sourceMessage.textContent =
                "Gagal terhubung ke server.";

            sourceMessage.style.color =
                "#ff5555";

        }
    }
);


/* BACK */

backBtn.addEventListener(
    "click",
    function() {
        window.location.href = "/";
    }
);


/* SECURITY */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {

    return escapeHTML(value);
}


loadUser();