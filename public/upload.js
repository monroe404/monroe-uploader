const params = new URLSearchParams(window.location.search);

const type =
    params.get("type") === "special"
        ? "special"
        : "public";

const form = document.getElementById("uploadForm");
const channelSearch = document.getElementById("channelSearch");
const channelResults = document.getElementById("channelResults");
const message = document.getElementById("uploadMessage");

let selectedChannel = "";


/* ================================
   SEARCH CHANNEL
================================ */

let searchTimer;

channelSearch.addEventListener("input", function () {

    clearTimeout(searchTimer);

    const query = this.value.trim();

    selectedChannel = "";

    if (!query) {
        channelResults.innerHTML = "";
        return;
    }

    searchTimer = setTimeout(async () => {

        try {

            const response = await fetch(
                `/api/channels?search=${encodeURIComponent(query)}`,
                {
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                channelResults.innerHTML =
                    `<div class="channel-empty">${data.message || "Gagal mengambil channel."}</div>`;
                return;
            }

            if (!data.channels || data.channels.length === 0) {

                channelResults.innerHTML =
                    `<div class="channel-empty">Channel tidak ditemukan.</div>`;

                return;
            }

            channelResults.innerHTML =
                data.channels.map(channel => `
                    <div
                        class="channel-item"
                        data-id="${channel.id}"
                        data-name="${escapeHtml(channel.name)}"
                    >
                        # ${escapeHtml(channel.name)}
                    </div>
                `).join("");


            document
                .querySelectorAll(".channel-item")
                .forEach(item => {

                    item.addEventListener("click", function () {

                        selectedChannel = this.dataset.id;

                        channelSearch.value =
                            this.dataset.name;

                        channelResults.innerHTML = "";

                    });

                });

        } catch (error) {

            channelResults.innerHTML =
                `<div class="channel-empty">Gagal terhubung ke server.</div>`;

        }

    }, 250);

});


/* ================================
   SUBMIT
================================ */

form.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (!selectedChannel) {

        message.textContent =
            "Pilih channel terlebih dahulu.";

        message.style.color = "#ff5555";

        return;
    }


    message.textContent =
        "Uploading...";

    message.style.color = "#aaa";


    const formData = new FormData(form);

    formData.set("type", type);

    formData.set("channelId", selectedChannel);


    try {

        const response = await fetch(
            "/api/upload",
            {
                method: "POST",
                credentials: "include",
                body: formData
            }
        );


        const data = await response.json();


        if (!response.ok) {

            message.textContent =
                data.message || "Upload gagal.";

            message.style.color = "#ff5555";

            return;
        }


        message.textContent =
            "File berhasil dipublish!";

        message.style.color =
            "#ff7a00";


        setTimeout(() => {

            if (data.shareURL) {

                window.location.href =
                    data.shareURL;

            } else {

                window.location.href = "/";

            }

        }, 800);


    } catch (error) {

        message.textContent =
            "Gagal terhubung ke server.";

        message.style.color =
            "#ff5555";

    }

});


/* ================================
   ESCAPE HTML
================================ */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}