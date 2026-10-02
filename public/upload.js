const params =
    new URLSearchParams(window.location.search);

const type =
    params.get("type") === "special"
        ? "special"
        : "public";


const form =
    document.getElementById("uploadForm");

const fileType =
    document.getElementById("fileType");

const uploadTitle =
    document.getElementById("uploadTitle");

const uploadDescription =
    document.getElementById("uploadDescription");

const channelField =
    document.getElementById("channelField");

const channelSearch =
    document.getElementById("channelSearch");

const channelId =
    document.getElementById("channelId");

const channelResults =
    document.getElementById("channelResults");

const socialFields =
    document.getElementById("socialFields");

const message =
    document.getElementById("uploadMessage");


/* ================================
   TYPE
================================ */

fileType.value = type;


if (type === "special") {

    uploadTitle.textContent =
        "SPECIAL FILE";

    uploadDescription.textContent =
        "Upload file khusus untuk Founder dan Uploader.";

    // Special tidak memilih channel
    channelField.style.display = "none";

    // Tampilkan TikTok + YouTube
    socialFields.style.display = "block";

} else {

    uploadTitle.textContent =
        "PUBLIC FILE";

    uploadDescription.textContent =
        "Upload file yang dapat dibagikan secara publik.";

    channelField.style.display = "block";

    socialFields.style.display = "none";

}


/* ================================
   SEARCH PUBLIC CHANNEL
================================ */

let searchTimer;

channelSearch.addEventListener(
    "input",
    function () {

        clearTimeout(searchTimer);

        channelId.value = "";

        const query =
            this.value.trim();

        channelResults.innerHTML = "";

        if (!query) {
            return;
        }

        searchTimer = setTimeout(
            async function () {

                try {

                    const response =
                        await fetch(
                            `/api/channels?search=${encodeURIComponent(query)}`,
                            {
                                credentials: "include"
                            }
                        );

                    const data =
                        await response.json();


                    if (!response.ok) {

                        channelResults.innerHTML =
                            `<div class="channel-empty">
                                ${data.message || "Gagal mengambil channel."}
                            </div>`;

                        return;
                    }


                    if (
                        !data.channels ||
                        data.channels.length === 0
                    ) {

                        channelResults.innerHTML =
                            `<div class="channel-empty">
                                Channel tidak ditemukan.
                            </div>`;

                        return;
                    }


                    channelResults.innerHTML =
                        data.channels.map(
                            function (channel) {

                                return `
                                    <div
                                        class="channel-item"
                                        data-id="${channel.id}"
                                        data-name="${escapeHtml(channel.name)}"
                                    >
                                        # ${escapeHtml(channel.name)}
                                    </div>
                                `;

                            }
                        ).join("");


                    document
                        .querySelectorAll(".channel-item")
                        .forEach(
                            function (item) {

                                item.addEventListener(
                                    "click",
                                    function () {

                                        channelId.value =
                                            this.dataset.id;

                                        channelSearch.value =
                                            this.dataset.name;

                                        channelResults.innerHTML =
                                            "";

                                    }
                                );

                            }
                        );

                } catch (error) {

                    channelResults.innerHTML =
                        `<div class="channel-empty">
                            Gagal terhubung ke server.
                        </div>`;

                }

            },
            250
        );

    }
);


/* ================================
   SUBMIT
================================ */

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        /*
         * PUBLIC wajib memilih channel.
         */

        if (
            type === "public" &&
            !channelId.value
        ) {

            message.textContent =
                "Pilih channel terlebih dahulu.";

            message.style.color =
                "#ff5555";

            return;
        }


        message.textContent =
            "Uploading...";

        message.style.color =
            "#aaa";


        const formData =
            new FormData(form);


        formData.set(
            "type",
            type
        );


        /*
         * Special tidak mengirim channel pilihan.
         * Backend akan otomatis memakai
         * UPLOADER_CHANNEL_ID.
         */

        if (type === "special") {

            formData.delete("channelId");

        }


        try {

            const response =
                await fetch(
                    "/api/upload",
                    {
                        method: "POST",

                        credentials: "include",

                        body: formData
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                message.textContent =
                    data.message ||
                    "Upload gagal.";

                message.style.color =
                    "#ff5555";

                return;
            }


            message.textContent =
                "File berhasil dipublish!";

            message.style.color =
                "#ff7a00";


            setTimeout(
                function () {

                    window.location.href =
                        data.shareURL || "/";

                },
                800
            );


        } catch (error) {

            message.textContent =
                "Gagal terhubung ke server.";

            message.style.color =
                "#ff5555";

        }

    }
);


/* ================================
   ESCAPE HTML
================================ */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;
}