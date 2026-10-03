const sourceForm =
    document.getElementById("sourceForm");

const sourceLink =
    document.getElementById("sourceLink");

const sourceMessage =
    document.getElementById("sourceMessage");

const backBtn =
    document.getElementById("backBtn");


sourceForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const link =
            sourceLink.value.trim();

        if (!link) {
            sourceMessage.textContent =
                "Link Discord wajib diisi.";

            sourceMessage.style.color =
                "#ff5555";

            return;
        }

        sourceMessage.textContent =
            "Menyimpan source...";

        sourceMessage.style.color =
            "#aaa";

        try {

            const response =
                await fetch("/api/source", {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        link: link
                    })
                });

            const data =
                await response.json();

            if (!response.ok) {

                sourceMessage.textContent =
                    data.message ||
                    "Gagal menyimpan source.";

                sourceMessage.style.color =
                    "#ff5555";

                return;
            }

            sourceMessage.textContent =
                "Source berhasil disimpan.";

            sourceMessage.style.color =
                "#ff7a00";

            sourceLink.value = "";

        } catch (error) {

            sourceMessage.textContent =
                "Gagal terhubung ke server.";

            sourceMessage.style.color =
                "#ff5555";
        }
    }
);


backBtn.addEventListener(
    "click",
    function() {
        window.location.href = "/";
    }
);