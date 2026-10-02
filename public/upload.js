const params = new URLSearchParams(
    window.location.search
);

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

const channelDropdownButton =
    document.getElementById(
        "channelDropdownButton"
    );

const socialFields =
    document.getElementById("socialFields");

const message =
    document.getElementById("uploadMessage");

const previewList =
    document.getElementById("previewList");


fileType.value = type;


/* =========================
   PAGE TYPE
========================= */

if (type === "special") {

    uploadTitle.textContent =
        "SPECIAL FILE";

    uploadDescription.textContent =
        "Upload file khusus untuk Founder dan Uploader.";

    channelField.style.display =
        "none";

    socialFields.style.display =
        "block";

} else {

    uploadTitle.textContent =
        "PUBLIC FILE";

    uploadDescription.textContent =
        "Upload file yang dapat dibagikan secara publik.";

    channelField.style.display =
        "block";

    socialFields.style.display =
        "none";

}


/* =========================
   CHANNEL
========================= */

let searchTimer = null;


/* LOAD CHANNEL */

async function loadChannels(
    search = ""
) {

    try {

        channelResults.innerHTML =
            `
            <div class="channel-loading">
                Loading channel...
            </div>
            `;


        const response =
            await fetch(
                `/api/channels?search=${encodeURIComponent(search)}`,
                {
                    credentials:
                        "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            channelResults.innerHTML =
                `
                <div class="channel-empty">
                    ${escapeHtml(
                        data.message ||
                        "Gagal mengambil channel."
                    )}
                </div>
                `;

            return;

        }


        if (
            !data.channels ||
            data.channels.length === 0
        ) {

            channelResults.innerHTML =
                `
                <div class="channel-empty">
                    Channel tidak ditemukan.
                </div>
                `;

            return;

        }


        channelResults.innerHTML =
            data.channels
                .map(
                    function (channel) {

                        return `
                        <div
                            class="channel-item"
                            data-id="${escapeHtml(channel.id)}"
                            data-name="${escapeHtml(channel.name)}"
                        >
                            <span class="channel-hash">
                                #
                            </span>

                            <span>
                                ${escapeHtml(
                                    channel.name
                                )}
                            </span>
                        </div>
                        `;

                    }
                )
                .join("");


        document
            .querySelectorAll(
                ".channel-item"
            )
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

        console.error(
            "CHANNEL ERROR:",
            error
        );

        channelResults.innerHTML =
            `
            <div class="channel-empty">
                Gagal terhubung ke server.
            </div>
            `;

    }

}


/* =========================
   CLICK INPUT
========================= */

if (channelSearch) {

    channelSearch.addEventListener(
    "focus",
    function () {

        loadChannels("");

    }
);


    /* =========================
       TYPE TO SEARCH
    ========================= */

    channelSearch.addEventListener(
        "input",
        function () {

            clearTimeout(
                searchTimer
            );


            channelId.value =
                "";


            const query =
                this.value.trim();


            searchTimer =
                setTimeout(
                    function () {

                        loadChannels(
                            query
                        );

                    },
                    250
                );

        }
    );

}


/* =========================
   DROPDOWN BUTTON
========================= */

if (channelDropdownButton) {

    channelDropdownButton.addEventListener(
        "click",
        function () {

            if (
                channelResults.innerHTML.trim()
            ) {

                channelResults.innerHTML =
                    "";

                return;

            }


            loadChannels(
                channelSearch.value.trim()
            );

            channelSearch.focus();

        }
    );

}


/* =========================
   CLOSE DROPDOWN
========================= */

document.addEventListener(
    "click",
    function (event) {

        if (
            !channelField.contains(
                event.target
            )
        ) {

            channelResults.innerHTML =
                "";

        }

    }
);


/* =========================
   ADD PREVIEW
========================= */

function addPreview() {

    const inputs =
        previewList.querySelectorAll(
            'input[name="previewUrls"]'
        );


    if (
        inputs.length >= 10
    ) {

        alert(
            "Maksimal 10 foto preview."
        );

        return;

    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "preview-input-row";


    row.innerHTML =
        `
        <input
            type="url"
            name="previewUrls"
            placeholder="https://cdn.discordapp.com/..."
        >

        <button
            type="button"
            class="remove-preview"
            onclick="removePreview(this)"
        >
            ×
        </button>
        `;


    previewList.appendChild(
        row
    );

}


/* =========================
   REMOVE PREVIEW
========================= */

function removePreview(
    button
) {

    const rows =
        previewList.querySelectorAll(
            ".preview-input-row"
        );


    if (
        rows.length <= 1
    ) {

        const input =
            button.parentElement
                .querySelector("input");


        if (input) {

            input.value =
                "";

        }

        return;

    }


    button.parentElement.remove();

}


/* =========================
   RESET
========================= */

function resetUploadForm() {

    /* SIMPAN CHANNEL */

    const savedChannelId =
        channelId
            ? channelId.value
            : "";

    const savedChannelName =
        channelSearch
            ? channelSearch.value
            : "";


    /* RESET FORM */

    form.reset();


    fileType.value =
        type;


    /* KEMBALIKAN CHANNEL */

    if (channelId) {

        channelId.value =
            savedChannelId;

    }


    if (channelSearch) {

        channelSearch.value =
            savedChannelName;

    }


    if (channelResults) {

        channelResults.innerHTML =
            "";

    }


    /* RESET PREVIEW */

    previewList.innerHTML =
        `
        <div class="preview-input-row">

            <input
                type="url"
                name="previewUrls"
                placeholder="https://cdn.discordapp.com/..."
            >

            <button
                type="button"
                class="remove-preview"
                onclick="removePreview(this)"
            >
                ×
            </button>

        </div>
        `;


    /* PAGE TYPE */

    if (type === "special") {

        channelField.style.display =
            "none";

        socialFields.style.display =
            "block";

    } else {

        channelField.style.display =
            "block";

        socialFields.style.display =
            "none";

    }

}


/* =========================
   SUBMIT
========================= */

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


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


        if (
            type === "special"
        ) {

            formData.delete(
                "channelId"
            );

        }


        try {

            const response =
                await fetch(
                    "/api/upload",
                    {
                        method:
                            "POST",

                        credentials:
                            "include",

                        body:
                            formData
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
                "✓ File berhasil dipublish!";

            message.style.color =
                "#ff7a00";


            resetUploadForm();


        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );


            message.textContent =
                "Gagal terhubung ke server.";

            message.style.color =
                "#ff5555";

        }

    }
);

const sourceModsToggle =
    document.getElementById(
        "sourceModsToggle"
    );

const sourceModsContent =
    document.getElementById(
        "sourceModsContent"
    );

const sourceModsArrow =
    document.getElementById(
        "sourceModsArrow"
    );


if (
    sourceModsToggle &&
    sourceModsContent
) {

    sourceModsToggle.addEventListener(
        "click",
        function () {

            const isOpen =
                sourceModsContent.style.display !==
                "none";


            if (isOpen) {

                sourceModsContent.style.display =
                    "none";

                sourceModsArrow.textContent =
                    "▼";

            } else {

                sourceModsContent.style.display =
                    "block";

                sourceModsArrow.textContent =
                    "▲";

            }

        }
    );

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(text);


    return div.innerHTML;

}